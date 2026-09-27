/**
 * Unified Duplex Audio Engine for TEF Live Oral Examinations & Admin AI Sandbox.
 *
 * Provides:
 * - 16kHz microphone stream capture with echo cancellation and noise suppression
 * - Real-time volume analysis (micLevel 0-100 & normalized candidateVolume 0.0-1.0)
 * - AudioWorklet processor with robust ScriptProcessor fallback
 * - Linear PCM 16kHz downsampling and Base64 framing
 * - Acoustic bleed gating (discards mic samples when AI audio plays through speakers and volume < 15%)
 * - Dual input modes: "hands_free" (continuous VAD) and "push_to_talk" (PTT)
 * - Push-to-Talk "T" keyboard shortcut toggle and 25-frame silence burst on turn release
 * - Low-latency gapless 24kHz PCM playback queue for Gemini Live examiner audio
 * - Full-duplex WebSocket client with interruption detection and auto-reconnect
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { AISpeakingState, AudioInputMode, WebRTCConnectionState } from "./types"

export interface LiveTranscriptEntry {
  id: string
  role: "examiner" | "candidate"
  text: string
  timestamp: number
}

export interface DuplexAudioEngineOptions {
  wsUrl: string | null
  enabled?: boolean
  defaultAudioInputMode?: AudioInputMode
  acousticBleedThreshold?: number // Default 15 (%)
  onTranscript?: (entry: LiveTranscriptEntry) => void
  onAISpeakingStateChange?: (state: AISpeakingState) => void
  onTurnChange?: (turn: "ai" | "student") => void
  onCustomMessage?: (msg: Record<string, unknown>) => void
  autoConnect?: boolean
}

const WORKLET_PROCESSOR_CODE = `
class TEFAudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      // Allocate copy so internal channel buffer mutation does not corrupt audio frames
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor('tef-audio-processor', TEFAudioProcessor);
`

export function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return output
  }
  const sampleRateRatio = inputSampleRate / 16000
  const newLength = Math.round(input.length / sampleRateRatio)
  const output = new Int16Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
      accum += input[i]
      count++
    }
    const sample = count > 0 ? accum / count : (input[offsetBuffer] || 0)
    const s = Math.max(-1, Math.min(1, sample))
    output[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return output
}

export function pcm16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength)
  let binary = ""
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function useDuplexAudioEngine({
  wsUrl,
  enabled = true,
  defaultAudioInputMode = "hands_free",
  acousticBleedThreshold = 15,
  onTranscript,
  onAISpeakingStateChange,
  onTurnChange,
  onCustomMessage,
  autoConnect = true,
}: DuplexAudioEngineOptions) {
  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>("new")
  const [audioInputMode, setAudioInputMode] = useState<AudioInputMode>(defaultAudioInputMode)
  const [isPttActive, setIsPttActive] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null)
  const [micLevel, setMicLevel] = useState<number>(0)
  const [candidateVolume, setCandidateVolume] = useState<number>(0)
  const [examinerVolume, setExaminerVolume] = useState<number>(0)
  const [isExaminerSpeaking, setIsExaminerSpeaking] = useState<boolean>(false)
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState<boolean>(false)
  const [aiState, setAiState] = useState<AISpeakingState>("listening")
  const [activeTurn, setActiveTurn] = useState<"ai" | "student">("ai")
  const [liveTranscript, setLiveTranscript] = useState<string>("")
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([])
  const [audioChunksSent, setAudioChunksSent] = useState<number>(0)
  const [interruptionCount, setInterruptionCount] = useState<number>(0)
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const workletBlobUrlRef = useRef<string | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const nextPlayTimeRef = useRef<number>(0)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const sampleBufferRef = useRef<Float32Array[]>([])
  const sampleBufferLenRef = useRef<number>(0)
  const audioChunksSentRef = useRef<number>(0)
  const micLevelRef = useRef<number>(0)
  const isMutedRef = useRef<boolean>(false)
  const isPttActiveRef = useRef<boolean>(false)
  const audioInputModeRef = useRef<AudioInputMode>(audioInputMode)
  const isIntentionalLeaveRef = useRef<boolean>(false)
  const reconnectAttemptsRef = useRef<number>(0)
  const isModelTurnCompleteRef = useRef<boolean>(false)
  const connectFnRef = useRef<() => void>(() => {})

  // Sync ref values
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    audioInputModeRef.current = audioInputMode
  }, [audioInputMode])

  useEffect(() => {
    isPttActiveRef.current = isPttActive
  }, [isPttActive])

  // Callbacks ref
  const callbacksRef = useRef({
    onTranscript,
    onAISpeakingStateChange,
    onTurnChange,
    onCustomMessage,
  })
  useEffect(() => {
    callbacksRef.current = {
      onTranscript,
      onAISpeakingStateChange,
      onTurnChange,
      onCustomMessage,
    }
  })

  // Stop all active examiner PCM playback buffers
  const stopAllPcmPlayback = useCallback(() => {
    isModelTurnCompleteRef.current = false
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch {}
    })
    activeSourcesRef.current = []
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime
    }
    setIsExaminerSpeaking(false)
    setExaminerVolume(0)
  }, [])

  // Play incoming 24kHz PCM chunk from Gemini Live
  const playPcmChunk = useCallback((base64Data: string, sampleRate = 24000) => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      return
    }

    try {
      const ctx = audioContextRef.current
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {})
      }

      const binaryStr = window.atob(base64Data)
      const len = binaryStr.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }

      const int16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate)
      audioBuffer.copyToChannel(float32, 0)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)

      const currentTime = ctx.currentTime
      const startTime = Math.max(currentTime, nextPlayTimeRef.current)
      source.start(startTime)
      nextPlayTimeRef.current = startTime + audioBuffer.duration

      activeSourcesRef.current.push(source)
      setIsExaminerSpeaking(true)
      setExaminerVolume(0.7)

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source)
        if (activeSourcesRef.current.length === 0) {
          setIsExaminerSpeaking(false)
          setExaminerVolume(0)
          if (isModelTurnCompleteRef.current) {
            isModelTurnCompleteRef.current = false
            setActiveTurn("student")
            setAiState("listening")
            if (callbacksRef.current.onAISpeakingStateChange) {
              callbacksRef.current.onAISpeakingStateChange("listening")
            }
            if (callbacksRef.current.onTurnChange) {
              callbacksRef.current.onTurnChange("student")
            }
          }
        }
      }
    } catch (e) {
      console.error("[useDuplexAudioEngine] PCM playback error:", e)
    }
  }, [])

  // Send trailing linear PCM silence burst to Gemini to trigger server VAD turn completion
  const flushSilenceBurst = useCallback((count = 25) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const silencePcm16 = new Int16Array(640)
    const silenceB64 = pcm16ToBase64(silencePcm16)
    const payload = JSON.stringify({
      action: "audio_chunk",
      type: "audio",
      data: silenceB64,
      mime_type: "audio/pcm;rate=16000",
    })
    for (let i = 0; i < count; i++) {
      try {
        wsRef.current.send(payload)
      } catch {}
    }
  }, [])

  // Toggle Push-to-Talk state
  const togglePtt = useCallback(() => {
    if (audioInputModeRef.current !== "push_to_talk") return

    if (!isPttActiveRef.current) {
      // Activating PTT (Candidate starts speaking)
      // Check for intentional barge-in: if examiner audio is playing, stop examiner playback immediately
      if (activeSourcesRef.current.length > 0) {
        stopAllPcmPlayback()
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ action: "interrupted", type: "interrupted" }))
          } catch {}
        }
      }
      isPttActiveRef.current = true
      setIsPttActive(true)
      setActiveTurn("student")
      if (callbacksRef.current.onTurnChange) {
        callbacksRef.current.onTurnChange("student")
      }
    } else {
      // Deactivating PTT (Candidate finishes speaking)
      isPttActiveRef.current = false
      setIsPttActive(false)
      // Flush silence burst to trigger server-side VAD turn completion
      flushSilenceBurst(25)
      setAiState("thinking")
      if (callbacksRef.current.onAISpeakingStateChange) {
        callbacksRef.current.onAISpeakingStateChange("thinking")
      }
    }
  }, [stopAllPcmPlayback, flushSilenceBurst])

  // Global keyboard shortcut for Push-to-Talk ("T" key toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (audioInputModeRef.current !== "push_to_talk" || !enabled) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      if ((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        togglePtt()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, togglePtt])

  // Send accumulated PCM samples over WebSocket to Gemini Live
  const sendAccumulatedAudio = useCallback(
    (audioCtx: AudioContext) => {
      if (
        isMutedRef.current ||
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN
      ) {
        // Discard pre-join or muted samples to prevent stale audio buffer burst
        sampleBufferRef.current = []
        sampleBufferLenRef.current = 0
        return
      }

      // In Push-to-Talk mode, discard microphone samples if candidate is not actively speaking
      if (audioInputModeRef.current === "push_to_talk" && !isPttActiveRef.current) {
        sampleBufferRef.current = []
        sampleBufferLenRef.current = 0
        return
      }

      if (sampleBufferLenRef.current < 2048) {
        return
      }

      const totalLen = sampleBufferLenRef.current

      // Acoustic bleed gating: if examiner audio is actively playing in speakers
      // and microphone level is below intentional speech threshold (e.g. 15%), discard buffer
      // to prevent speaker audio from triggering server-side VAD interruption loop.
      if (activeSourcesRef.current.length > 0 && micLevelRef.current < acousticBleedThreshold) {
        sampleBufferRef.current = []
        sampleBufferLenRef.current = 0
        return
      }

      const merged = new Float32Array(totalLen)
      let offset = 0
      for (const chunk of sampleBufferRef.current) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      sampleBufferRef.current = []
      sampleBufferLenRef.current = 0

      const pcm16 = downsampleTo16k(merged, audioCtx.sampleRate)
      if (pcm16.length === 0) return

      const base64Chunk = pcm16ToBase64(pcm16)

      try {
        wsRef.current.send(
          JSON.stringify({
            action: "audio_chunk",
            type: "audio",
            data: base64Chunk,
            mime_type: "audio/pcm;rate=16000",
          })
        )
        audioChunksSentRef.current += 1
        setAudioChunksSent(audioChunksSentRef.current)
      } catch (err) {
        console.warn("[useDuplexAudioEngine] Send audio chunk failed:", err)
      }
    },
    [acousticBleedThreshold]
  )

  // Ensure AudioContext and microphone pipeline
  const ensureAudioPipeline = useCallback(async () => {
    if (audioContextRef.current && localStreamRef.current) {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume().catch(() => {})
      }
      return audioContextRef.current
    }

    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        return null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      localStreamRef.current = stream
      setHasMicPermission(true)

      const AudioCtxClass =
        (typeof window !== "undefined" && window.AudioContext) ||
        (typeof window !== "undefined" &&
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)

      if (!AudioCtxClass) {
        return null
      }

      let ctx: AudioContext
      try {
        ctx = new AudioCtxClass({ sampleRate: 16000 })
      } catch {
        ctx = new AudioCtxClass()
      }
      audioContextRef.current = ctx
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {})
      }

      const sourceNode = ctx.createMediaStreamSource(stream)
      sourceNodeRef.current = sourceNode

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.4
      analyserRef.current = analyser
      sourceNode.connect(analyser)

      // Continuous volume metering
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const pollVolume = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        const normVolume = Math.min(1, avg / 128)
        const computedLevel = Math.min(100, Math.round(normVolume * 100))

        micLevelRef.current = computedLevel
        setMicLevel(computedLevel)
        setCandidateVolume(normVolume)

        const speaking = normVolume > 0.08 && !isMutedRef.current
        setIsCandidateSpeaking(speaking)

        animFrameRef.current = requestAnimationFrame(pollVolume)
      }
      animFrameRef.current = requestAnimationFrame(pollVolume)

      // AudioWorklet initialization with ScriptProcessor fallback
      let usedWorklet = false
      if (ctx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        try {
          if (!workletBlobUrlRef.current) {
            const blob = new Blob([WORKLET_PROCESSOR_CODE], {
              type: "application/javascript",
            })
            workletBlobUrlRef.current = URL.createObjectURL(blob)
          }
          await ctx.audioWorklet.addModule(workletBlobUrlRef.current)
          const workletNode = new AudioWorkletNode(ctx, "tef-audio-processor")
          workletNodeRef.current = workletNode

          workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
            const data = event.data
            if (!data || isMutedRef.current) return
            sampleBufferRef.current.push(data)
            sampleBufferLenRef.current += data.length
            if (sampleBufferLenRef.current >= 2048) {
              sendAccumulatedAudio(ctx)
            }
          }

          sourceNode.connect(workletNode)
          const silentGain = ctx.createGain()
          silentGain.gain.value = 0.00001
          silentGainRef.current = silentGain
          workletNode.connect(silentGain)
          silentGain.connect(ctx.destination)
          usedWorklet = true
        } catch (workletErr) {
          console.warn("[useDuplexAudioEngine] AudioWorklet init failed, using ScriptProcessor:", workletErr)
        }
      }

      if (!usedWorklet) {
        const bufferSize = 4096
        const processor = ctx.createScriptProcessor(bufferSize, 1, 1)
        processorNodeRef.current = processor

        const silentGain = ctx.createGain()
        silentGain.gain.value = 0.00001
        silentGainRef.current = silentGain

        sourceNode.connect(processor)
        processor.connect(silentGain)
        silentGain.connect(ctx.destination)

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return
          const channelData = e.inputBuffer.getChannelData(0)
          sampleBufferRef.current.push(new Float32Array(channelData))
          sampleBufferLenRef.current += channelData.length
          if (sampleBufferLenRef.current >= 2048) {
            sendAccumulatedAudio(ctx)
          }
        }
      }

      return ctx
    } catch (err) {
      console.warn("[useDuplexAudioEngine] Microphone access failed:", err)
      setHasMicPermission(false)
      setError("Microphone access denied or audio device unavailable.")
      return null
    }
  }, [sendAccumulatedAudio])

  // Explicit user gesture to request microphone permission
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      await ensureAudioPipeline()
      return localStreamRef.current !== null
    } catch {
      setHasMicPermission(false)
      return false
    }
  }, [ensureAudioPipeline])

  // Explicit user gesture to resume suspended AudioContext
  const resumeAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume().catch(() => {})
      }
      return audioContextRef.current
    }
    return ensureAudioPipeline()
  }, [ensureAudioPipeline])

  // Connect WebSocket signaling and audio streaming
  const connect = useCallback(() => {
    if (!wsUrl || !enabled || isIntentionalLeaveRef.current) return

    setConnectionState("connecting")

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = async () => {
        setConnectionState("connected")
        setIsReconnecting(false)
        reconnectAttemptsRef.current = 0
        await ensureAudioPipeline()
      }

      ws.onmessage = async (event) => {
        try {
          const envelope = JSON.parse(event.data) as Record<string, unknown>
          const action = (envelope.action || envelope.type) as string
          const data = envelope.data as Record<string, unknown> | undefined
          const cbs = callbacksRef.current

          if (action === "connected") {
            // Handshake confirmed
          } else if (action === "audio_chunk" || action === "audio") {
            const rawB64 = (envelope.data || data?.data) as string
            if (rawB64) {
              setAiState("speaking")
              setActiveTurn("ai")
              playPcmChunk(rawB64, (envelope.sample_rate as number) || 24000)
            }
          } else if (action === "interrupted") {
            stopAllPcmPlayback()
            isModelTurnCompleteRef.current = false
            setAiState("listening")
            setActiveTurn("student")
            setInterruptionCount((prev) => prev + 1)
            if (cbs.onAISpeakingStateChange) cbs.onAISpeakingStateChange("listening")
            if (cbs.onTurnChange) cbs.onTurnChange("student")
          } else if (action === "transcript") {
            const role = (envelope.role || data?.role) as "examiner" | "candidate"
            const text = (envelope.text || data?.text) as string
            if (text) {
              const displayRole = role === "examiner" ? "Examinateur" : "Candidat"
              const line = `${displayRole} : ${text}`
              setLiveTranscript((prev) => (prev ? `${prev}\n${line}` : line))

              const entry: LiveTranscriptEntry = {
                id: Math.random().toString(36).substring(2, 9),
                role: role || "examiner",
                text,
                timestamp: Date.now(),
              }
              setTranscripts((prev) => [...prev, entry])
              if (cbs.onTranscript) cbs.onTranscript(entry)
            }
          } else if (action === "turn_change") {
            const nextTurn = ((envelope.turn || data?.turn) as "ai" | "student") || "ai"
            if (nextTurn === "student") {
              if (activeSourcesRef.current.length > 0) {
                isModelTurnCompleteRef.current = true
              } else {
                setActiveTurn("student")
                setAiState("listening")
                if (cbs.onAISpeakingStateChange) cbs.onAISpeakingStateChange("listening")
                if (cbs.onTurnChange) cbs.onTurnChange("student")
                isModelTurnCompleteRef.current = false
              }
            } else {
              isModelTurnCompleteRef.current = false
              setActiveTurn("ai")
              if (cbs.onTurnChange) cbs.onTurnChange("ai")
            }
          } else if (action === "voice_activity") {
            const status = (envelope.status || data?.status) as string
            if (status === "speaking") {
              setAiState("listening")
              setActiveTurn("student")
            } else if (status === "finished") {
              setAiState("thinking")
            }
          }

          if (cbs.onCustomMessage) {
            cbs.onCustomMessage(envelope)
          }
        } catch {
          // Ignore non-json frames
        }
      }

      ws.onclose = () => {
        if (!isIntentionalLeaveRef.current) {
          setConnectionState("reconnecting")
          setIsReconnecting(true)

          if (reconnectAttemptsRef.current < 4) {
            const timeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 8000)
            reconnectAttemptsRef.current += 1
            setTimeout(() => {
              if (!isIntentionalLeaveRef.current) {
                connectFnRef.current()
              }
            }, timeout)
          } else {
            setConnectionState("failed")
            setIsReconnecting(false)
            setError("Connexion au serveur perdue.")
          }
        } else {
          setConnectionState("closed")
        }
      }

      ws.onerror = () => {
        setConnectionState("failed")
      }
    } catch (err) {
      setConnectionState("failed")
      setError(err instanceof Error ? err.message : "Erreur de connexion WebSocket.")
    }
  }, [wsUrl, enabled, ensureAudioPipeline, playPcmChunk, stopAllPcmPlayback])

  useEffect(() => {
    connectFnRef.current = connect
  }, [connect])

  // Automatically connect when wsUrl and enabled are ready
  useEffect(() => {
    if (autoConnect && wsUrl && enabled) {
      isIntentionalLeaveRef.current = false
      connect()
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [autoConnect, wsUrl, enabled, connect])

  // Send raw JSON message to WebSocket
  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(msg))
      } catch (err) {
        console.warn("[useDuplexAudioEngine] Send message failed:", err)
      }
    }
  }, [])

  // Send text message (e.g. candidate typed input or text turn)
  const sendTextMessage = useCallback(
    (text: string) => {
      sendMessage({
        action: "text_turn",
        type: "text",
        text,
      })
    },
    [sendMessage]
  )

  // Send interruption signal (manual barge-in)
  const triggerInterruption = useCallback(() => {
    stopAllPcmPlayback()
    sendMessage({
      action: "interrupted",
      type: "interrupted",
    })
  }, [stopAllPcmPlayback, sendMessage])

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      isMutedRef.current = next
      if (next) {
        sampleBufferRef.current = []
        sampleBufferLenRef.current = 0
      }
      return next
    })
  }, [])

  // Full cleanup (intentional stop / leave)
  const cleanup = useCallback(() => {
    isIntentionalLeaveRef.current = true
    stopAllPcmPlayback()
    isPttActiveRef.current = false
    setIsPttActive(false)

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect()
      } catch {}
      workletNodeRef.current = null
    }
    if (workletBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(workletBlobUrlRef.current)
      } catch {}
      workletBlobUrlRef.current = null
    }
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect()
      } catch {}
      processorNodeRef.current = null
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect()
      } catch {}
      sourceNodeRef.current = null
    }
    if (silentGainRef.current) {
      try {
        silentGainRef.current.disconnect()
      } catch {}
      silentGainRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {})
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    sampleBufferRef.current = []
    sampleBufferLenRef.current = 0
    setConnectionState("closed")
  }, [stopAllPcmPlayback])

  return {
    connectionState,
    audioInputMode,
    setAudioInputMode,
    isPttActive,
    togglePtt,
    flushSilenceBurst,
    isMuted,
    toggleMute,
    hasMicPermission,
    micLevel,
    candidateVolume,
    examinerVolume,
    isExaminerSpeaking,
    isCandidateSpeaking,
    aiState,
    activeTurn,
    liveTranscript,
    transcripts,
    audioChunksSent,
    interruptionCount,
    isReconnecting,
    error,
    requestMicPermission,
    resumeAudioContext,
    connect,
    sendMessage,
    sendTextMessage,
    triggerInterruption,
    stopAllPcmPlayback,
    cleanup,
    wsRef,
    audioContextRef,
    localStreamRef,
  }
}
