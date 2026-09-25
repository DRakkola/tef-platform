/**
 * Custom hook for audio-only WebRTC peer connection and WebSocket signaling / Gemini Live
 * for speaking sessions. Strictly enforces NO video track requests.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { config } from "@/core/config"
import type {
  AISpeakingState,
  SignalingEnvelope,
  WebRTCConnectionState,
} from "./types"

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

const WORKLET_PROCESSOR_CODE = `
class TEFAudioProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('tef-audio-processor', TEFAudioProcessor);
`

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
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

function pcm16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength)
  let binary = ""
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

interface UseSpeakingWebRTCOptions {
  roomId?: string
  sessionId?: string
  enabled?: boolean
  iceServers?: Array<{
    urls: string | string[]
    username?: string
    credential?: string
  }>
  onPeerLeft?: () => void
  onTurnChange?: (turn: "ai" | "student") => void
  onAISpeakingStateChange?: (state: AISpeakingState) => void
  onTranscriptUpdate?: (transcript: string) => void
}

export function useSpeakingWebRTC({
  roomId,
  sessionId: _sessionId,
  enabled = true,
  iceServers = DEFAULT_ICE_SERVERS,
  onPeerLeft,
  onTurnChange,
  onAISpeakingStateChange,
  onTranscriptUpdate,
}: UseSpeakingWebRTCOptions) {
  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>("new")
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null)
  const [micLevel, setMicLevel] = useState<number>(0)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [aiState, setAiState] = useState<AISpeakingState>("listening")
  const [activeTurn, setActiveTurn] = useState<"ai" | "student">("ai")
  const [liveTranscript, setLiveTranscript] = useState<string>("")

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const remotePeerIdRef = useRef<string | null>(null)
  const reconnectAttemptsRef = useRef<number>(0)
  const isIntentionalLeaveRef = useRef<boolean>(false)
  const isMutedRef = useRef<boolean>(false)

  // Stable callbacks ref so callback changes don't re-trigger connection effects
  const callbacksRef = useRef({
    onPeerLeft,
    onTurnChange,
    onAISpeakingStateChange,
    onTranscriptUpdate,
  })
  useEffect(() => {
    callbacksRef.current = {
      onPeerLeft,
      onTurnChange,
      onAISpeakingStateChange,
      onTranscriptUpdate,
    }
  })

  // Audio nodes and capture refs
  const nextPlayTimeRef = useRef<number>(0)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const workletBlobUrlRef = useRef<string | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const sampleBufferRef = useRef<Float32Array[]>([])
  const sampleBufferLenRef = useRef<number>(0)
  const audioChunksSentRef = useRef<number>(0)

  // Sync isMutedRef
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  // Stop all active audio playback buffers
  const stopAllPcmPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop()
      } catch {
        // Source may already have ended
      }
    })
    activeSourcesRef.current = []
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime
    }
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
      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source)
        if (idx > -1) {
          activeSourcesRef.current.splice(idx, 1)
        }
      }
    } catch {
      // Ignore malformed audio buffer decode
    }
  }, [])

  // Send accumulated PCM samples over WebSocket to Gemini Live
  const sendAccumulatedAudio = useCallback((audioCtx: AudioContext) => {
    if (
      isMutedRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      sampleBufferLenRef.current < 2048
    ) {
      return
    }

    const totalLen = sampleBufferLenRef.current
    const merged = new Float32Array(totalLen)
    let offset = 0
    for (const chunk of sampleBufferRef.current) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    sampleBufferRef.current = []
    sampleBufferLenRef.current = 0

    const pcm16 = downsampleTo16k(merged, audioCtx.sampleRate)
    const base64Chunk = pcm16ToBase64(pcm16)

    try {
      wsRef.current.send(
        JSON.stringify({
          action: "audio_chunk",
          data: base64Chunk,
          mime_type: "audio/pcm;rate=16000",
        })
      )
      audioChunksSentRef.current += 1
      if (audioChunksSentRef.current === 1 || audioChunksSentRef.current % 50 === 0) {
        console.log(`[SpeakingAudio] Streaming audio chunk #${audioChunksSentRef.current} to examiner (${base64Chunk.length} bytes)`)
      }
    } catch (err) {
      console.warn("[SpeakingAudio] Send audio chunk failed:", err)
    }
  }, [])

  // Ensure Audio Pipeline (mic capture, downsampler, and non-echoing streaming)
  const ensureAudioPipeline = useCallback(async () => {
    if (!localStreamRef.current) return

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    let audioCtx = audioContextRef.current
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx
    }

    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume()
      } catch (err) {
        console.warn("[SpeakingAudio] AudioContext resume failed:", err)
      }
    }

    if (workletNodeRef.current || processorNodeRef.current) {
      return
    }

    try {
      if (!sourceNodeRef.current && localStreamRef.current) {
        sourceNodeRef.current = audioCtx.createMediaStreamSource(localStreamRef.current)
      }
      const source = sourceNodeRef.current
      if (!source) return

      // Try AudioWorklet first (modern, low-latency, resilient against main-thread stalls)
      if (audioCtx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        try {
          if (!workletBlobUrlRef.current) {
            const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: "application/javascript" })
            workletBlobUrlRef.current = URL.createObjectURL(blob)
          }
          await audioCtx.audioWorklet.addModule(workletBlobUrlRef.current)
          const workletNode = new AudioWorkletNode(audioCtx, "tef-audio-processor")
          workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
            const data = event.data
            if (!data || isMutedRef.current) return
            sampleBufferRef.current.push(data)
            sampleBufferLenRef.current += data.length
            if (sampleBufferLenRef.current >= 2048) {
              sendAccumulatedAudio(audioCtx!)
            }
          }
          source.connect(workletNode)
          workletNodeRef.current = workletNode
          console.log("[SpeakingAudio] AudioWorklet pipeline initialized successfully.")
          return
        } catch (workletErr) {
          console.warn("[SpeakingAudio] AudioWorklet init failed, falling back to ScriptProcessor:", workletErr)
        }
      }

      // Fallback: ScriptProcessorNode with destination pull connection
      const silentGain = audioCtx.createGain()
      silentGain.gain.value = 0.00001 // Non-zero prevents Gecko/Blink from optimizing out the pull graph
      silentGain.connect(audioCtx.destination)
      silentGainRef.current = silentGain

      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) return
        const channelData = e.inputBuffer.getChannelData(0)
        sampleBufferRef.current.push(new Float32Array(channelData))
        sampleBufferLenRef.current += channelData.length
        if (sampleBufferLenRef.current >= 2048) {
          sendAccumulatedAudio(audioCtx!)
        }
      }

      source.connect(processor)
      processor.connect(silentGain)
      processorNodeRef.current = processor
      console.log("[SpeakingAudio] ScriptProcessor pipeline initialized.")
    } catch (err) {
      console.error("[SpeakingAudio] Audio pipeline initialization failed:", err)
    }
  }, [sendAccumulatedAudio])

  // Resume AudioContext (must be callable synchronously during a user click)
  const resumeAudioContext = useCallback(async () => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null

    let audioCtx = audioContextRef.current
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx
    }

    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume()
      } catch (err) {
        console.warn("[SpeakingAudio] AudioContext resume failed:", err)
      }
    }
    await ensureAudioPipeline()
    return audioCtx
  }, [ensureAudioPipeline])

  // 1. Request Microphone Permission & Initialize Local Audio Stream
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setHasMicPermission(false)
      setError("Périphérique audio ou navigateur non pris en charge.")
      return false
    }

    try {
      // Resume audio context immediately within user click gesture
      await resumeAudioContext()

      // Strictly audio: true, video: false
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      // Ensure zero video tracks
      if (stream.getVideoTracks().length > 0) {
        stream.getVideoTracks().forEach((track) => track.stop())
      }

      localStreamRef.current = stream
      setHasMicPermission(true)
      setError(null)

      let audioCtx = audioContextRef.current
      if (!audioCtx || audioCtx.state === "closed") {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          audioCtx = new AudioCtx()
          audioContextRef.current = audioCtx
        }
      }

      // Audio Level Analyzer (throttled to max 10fps to avoid React render thrashing)
      if (audioCtx) {
        try {
          const source = audioCtx.createMediaStreamSource(stream)
          sourceNodeRef.current = source
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 64
          source.connect(analyser)
          analyserRef.current = analyser

          const pcmData = new Uint8Array(analyser.frequencyBinCount)
          let lastMeterUpdate = 0
          let lastLevel = 0

          const checkVolume = () => {
            if (analyserRef.current && !isMutedRef.current) {
              const now = performance.now()
              if (now - lastMeterUpdate > 100) {
                lastMeterUpdate = now
                analyserRef.current.getByteFrequencyData(pcmData)
                let sum = 0
                for (let i = 0; i < pcmData.length; i++) {
                  sum += pcmData[i]
                }
                const avg = sum / pcmData.length
                const lvl = Math.min(100, Math.round((avg / 128) * 100))
                if (Math.abs(lvl - lastLevel) >= 2) {
                  lastLevel = lvl
                  setMicLevel(lvl)
                }
              }
            } else {
              setMicLevel(0)
            }
            animFrameRef.current = requestAnimationFrame(checkVolume)
          }
          checkVolume()

          await ensureAudioPipeline()
        } catch {
          // Fallback if AudioContext is blocked by browser policy
        }
      }

      return true
    } catch {
      setHasMicPermission(false)
      setError(
        "L'accès au microphone a été refusé. Veuillez autoriser l'accès au micro dans les paramètres de votre navigateur pour continuer."
      )
      return false
    }
  }, [ensureAudioPipeline, resumeAudioContext])

  // 2. Mute / Unmute Toggle
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const newMuted = !isMuted
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted
      })
      setIsMuted(newMuted)
      if (newMuted) {
        setMicLevel(0)
      }
    }
  }, [isMuted])

  // 3. Initialize WebRTC Peer Connection (for Teacher / Peer sessions)
  const createPeerConnection = useCallback(() => {
    if (typeof RTCPeerConnection === "undefined") {
      return null
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const msg: SignalingEnvelope = {
          action: "ice_candidate",
          target_id: remotePeerIdRef.current || undefined,
          data: { candidate: event.candidate.toJSON() },
        }
        wsRef.current.send(JSON.stringify(msg))
      }
    }

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState as WebRTCConnectionState
      setConnectionState(st)
      if (st === "connected") {
        setIsReconnecting(false)
        reconnectAttemptsRef.current = 0
      } else if (st === "disconnected" || st === "failed") {
        if (!isIntentionalLeaveRef.current) {
          setIsReconnecting(true)
        }
      }
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (event.track.kind === "audio") {
          setRemoteStream(event.streams[0])
        }
      }
    }

    // Attach local audio tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    pcRef.current = pc
    return pc
  }, [iceServers])

  // 4. WebSocket Signaling & Audio Connection
  const connectSignaling = useCallback(() => {
    if (!roomId || !enabled || isIntentionalLeaveRef.current) return

    const token = localStorage.getItem("auth_token") || ""
    const apiUrl = config.apiUrl
    let wsBase = ""
    if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
      wsBase = apiUrl.replace(/^http/, "ws")
    } else if (typeof window !== "undefined") {
      // In local dev when Vite runs on 5173/5174, connect directly to FastAPI on 8000
      if ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && /^517\d$/.test(window.location.port)) {
        wsBase = `ws://${window.location.hostname}:8000/api/v1`
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
        const cleanApi = apiUrl.startsWith("/") ? apiUrl : `/${apiUrl}`
        wsBase = `${protocol}//${window.location.host}${cleanApi}`
      }
    } else {
      wsBase = "ws://localhost:8000/api/v1"
    }
    const wsUrl = `${wsBase}/speaking/ws/${roomId}?token=${encodeURIComponent(token)}`

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
          const envelope: SignalingEnvelope = JSON.parse(event.data)
          const { action, sender_id, data } = envelope
          const cbs = callbacksRef.current

          if (action === "connected") {
            createPeerConnection()
          } else if (action === "audio_chunk") {
            const audioData = (data?.data || envelope.data) as string
            if (audioData) {
              setAiState("speaking")
              setActiveTurn("ai")
              playPcmChunk(audioData, 24000)
            }
          } else if (action === "interrupted") {
            stopAllPcmPlayback()
            setAiState("listening")
            setActiveTurn("student")
          } else if (action === "transcript") {
            const role = data?.role === "examiner" ? "Examinateur" : "Candidat"
            const text = data?.text as string
            if (text) {
              const line = `${role} : ${text}`
              setLiveTranscript((prev) => {
                const updated = prev ? `${prev}\n${line}` : line
                if (cbs.onTranscriptUpdate) cbs.onTranscriptUpdate(updated)
                return updated
              })
            }
          } else if (action === "participant_joined") {
            remotePeerIdRef.current = sender_id || null
            if (pcRef.current) {
              const offer = await pcRef.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
              })
              await pcRef.current.setLocalDescription(offer)
              ws.send(
                JSON.stringify({
                  action: "offer",
                  target_id: sender_id,
                  data: { sdp: offer.sdp, type: offer.type },
                })
              )
            }
          } else if (action === "offer") {
            remotePeerIdRef.current = sender_id || null
            if (pcRef.current && data?.sdp) {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription({
                  sdp: data.sdp as string,
                  type: data.type as RTCSdpType,
                })
              )
              const answer = await pcRef.current.createAnswer()
              await pcRef.current.setLocalDescription(answer)
              ws.send(
                JSON.stringify({
                  action: "answer",
                  target_id: sender_id,
                  data: { sdp: answer.sdp, type: answer.type },
                })
              )
            }
          } else if (action === "answer") {
            if (pcRef.current && data?.sdp) {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription({
                  sdp: data.sdp as string,
                  type: data.type as RTCSdpType,
                })
              )
            }
          } else if (action === "ice_candidate") {
            if (pcRef.current && data?.candidate) {
              await pcRef.current.addIceCandidate(
                new RTCIceCandidate(data.candidate as RTCIceCandidateInit)
              )
            }
          } else if (action === "participant_left") {
            remotePeerIdRef.current = null
            setRemoteStream(null)
            if (cbs.onPeerLeft) cbs.onPeerLeft()
          } else if (action === "turn_change") {
            const nextTurn = (data?.turn as "ai" | "student") || "ai"
            setActiveTurn(nextTurn)
            if (data?.ai_state) {
              setAiState(data.ai_state as AISpeakingState)
              if (cbs.onAISpeakingStateChange) cbs.onAISpeakingStateChange(data.ai_state as AISpeakingState)
            }
            if (cbs.onTurnChange) cbs.onTurnChange(nextTurn)
          } else if (action === "ai_state") {
            const nextAiState = (data?.state as AISpeakingState) || "listening"
            setAiState(nextAiState)
            if (cbs.onAISpeakingStateChange) cbs.onAISpeakingStateChange(nextAiState)
          }
        } catch {
          // Ignore malformed signaling packets
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
                connectSignaling()
              }
            }, timeout)
          } else {
            setConnectionState("failed")
            setIsReconnecting(false)
            setError("Connexion au serveur perdue. Veuillez réessayer de vous reconnecter.")
          }
        } else {
          setConnectionState("closed")
        }
      }

      ws.onerror = () => {
        setConnectionState("failed")
      }
    } catch {
      setConnectionState("failed")
    }
  }, [
    roomId,
    enabled,
    createPeerConnection,
    playPcmChunk,
    stopAllPcmPlayback,
    ensureAudioPipeline,
  ])

  // Lifecycle Initialization: strictly depends on roomId and enabled
  useEffect(() => {
    isIntentionalLeaveRef.current = false
    if (roomId && enabled) {
      connectSignaling()
    }

    return () => {
      isIntentionalLeaveRef.current = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (pcRef.current) {
        pcRef.current.close()
        pcRef.current = null
      }
      stopAllPcmPlayback()
    }
  }, [roomId, enabled, connectSignaling, stopAllPcmPlayback])

  // Manual Reconnect
  const reconnect = useCallback(async () => {
    reconnectAttemptsRef.current = 0
    setError(null)
    setIsReconnecting(true)
    if (wsRef.current) {
      wsRef.current.close()
    }
    if (pcRef.current) {
      pcRef.current.close()
    }
    connectSignaling()
  }, [connectSignaling])

  // Intentional Leave / Audio Cleanup
  const cleanup = useCallback(() => {
    isIntentionalLeaveRef.current = true
    stopAllPcmPlayback()
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
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
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
  }, [stopAllPcmPlayback])

  return {
    connectionState,
    isMuted,
    hasMicPermission,
    micLevel,
    remoteStream,
    isReconnecting,
    error,
    aiState,
    activeTurn,
    liveTranscript,
    requestMicPermission,
    resumeAudioContext,
    toggleMute,
    reconnect,
    cleanup,
  }
}
