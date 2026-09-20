/**
 * Custom hook for audio-only WebRTC peer connection and WebSocket signaling
 * for speaking sessions. Strictly enforces NO video track requests.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { config } from "@/core/config"
import type {
  AISpeakingState,
  SignalingEnvelope,
  WebRTCConnectionState,
} from "./types"

interface UseSpeakingWebRTCOptions {
  roomId?: string
  sessionId?: string
  iceServers?: Array<{
    urls: string | string[]
    username?: string
    credential?: string
  }>
  onPeerLeft?: () => void
  onTurnChange?: (turn: "ai" | "student") => void
  onAISpeakingStateChange?: (state: AISpeakingState) => void
}

export function useSpeakingWebRTC({
  roomId,
  sessionId: _sessionId,
  iceServers = [{ urls: "stun:stun.l.google.com:19302" }],
  onPeerLeft,
  onTurnChange,
  onAISpeakingStateChange,
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

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const remotePeerIdRef = useRef<string | null>(null)
  const reconnectAttemptsRef = useRef<number>(0)
  const isIntentionalLeaveRef = useRef<boolean>(false)

  // 1. Request Microphone Permission & Initialize Local Audio Stream
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setHasMicPermission(false)
      setError("Périphérique audio ou navigateur non pris en charge.")
      return false
    }

    try {
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

      // Audio Level Analyzer (lightweight PCM metering)
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        try {
          const audioCtx = new AudioCtx()
          audioContextRef.current = audioCtx
          const source = audioCtx.createMediaStreamSource(stream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 64
          source.connect(analyser)
          analyserRef.current = analyser

          const pcmData = new Uint8Array(analyser.frequencyBinCount)
          const checkVolume = () => {
            if (analyserRef.current && !isMuted) {
              analyserRef.current.getByteFrequencyData(pcmData)
              let sum = 0
              for (let i = 0; i < pcmData.length; i++) {
                sum += pcmData[i]
              }
              const avg = sum / pcmData.length
              setMicLevel(Math.min(100, Math.round((avg / 128) * 100)))
            } else {
              setMicLevel(0)
            }
            animFrameRef.current = requestAnimationFrame(checkVolume)
          }
          checkVolume()
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
  }, [isMuted])

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

  // 3. Initialize WebRTC Peer Connection
  const createPeerConnection = useCallback(() => {
    if (typeof RTCPeerConnection === "undefined") {
      return null
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: "stun:stun.l.google.com:19302" }],
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

  // 4. WebSocket Signaling Connection
  const connectSignaling = useCallback(() => {
    if (!roomId || isIntentionalLeaveRef.current) return

    const token = localStorage.getItem("auth_token") || ""
    const apiUrl = config.apiUrl
    const wsBase = apiUrl.replace(/^http/, "ws")
    const wsUrl = `${wsBase}/speaking/ws/${roomId}?token=${encodeURIComponent(token)}`

    setConnectionState("connecting")

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionState("connected")
        setIsReconnecting(false)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = async (event) => {
        try {
          const envelope: SignalingEnvelope = JSON.parse(event.data)
          const { action, sender_id, data } = envelope

          if (action === "connected") {
            createPeerConnection()
          } else if (action === "participant_joined") {
            remotePeerIdRef.current = sender_id || null
            // Peer joined: create offer
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
            if (onPeerLeft) onPeerLeft()
          } else if (action === "turn_change") {
            const nextTurn = (data?.turn as "ai" | "student") || "ai"
            setActiveTurn(nextTurn)
            if (onTurnChange) onTurnChange(nextTurn)
          } else if (action === "ai_state") {
            const nextAiState = (data?.state as AISpeakingState) || "listening"
            setAiState(nextAiState)
            if (onAISpeakingStateChange) onAISpeakingStateChange(nextAiState)
          }
        } catch {
          // Ignore malformed signaling packets
        }
      }

      ws.onclose = () => {
        if (!isIntentionalLeaveRef.current) {
          setConnectionState("reconnecting")
          setIsReconnecting(true)

          // Exponential backoff reconnect
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
  }, [roomId, createPeerConnection, onPeerLeft, onTurnChange, onAISpeakingStateChange])

  // Connect signaling on roomId mount
  useEffect(() => {
    isIntentionalLeaveRef.current = false
    if (roomId) {
      connectSignaling()
    }

    return () => {
      // Safe cleanup
      isIntentionalLeaveRef.current = true
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
    }
  }, [roomId, connectSignaling])

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
  }, [])

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
    requestMicPermission,
    toggleMute,
    reconnect,
    cleanup,
  }
}
