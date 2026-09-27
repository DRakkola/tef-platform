/**
 * Custom hook for speaking sessions combining WebRTC peer connection (teacher/peer sessions)
 * with the unified useDuplexAudioEngine for acoustic bleed gating, PTT controls, and Gemini Live streaming.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { config } from "@/core/config"
import { useDuplexAudioEngine } from "./useDuplexAudioEngine"
import type {
  AISpeakingState,
  AudioInputMode,
  SignalingEnvelope,
} from "./types"

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

export type AudioHealthStatus =
  | "permission_required"
  | "permission_denied"
  | "initializing"
  | "ready"
  | "error"

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
  defaultAudioInputMode?: AudioInputMode
}

export function useSpeakingWebRTC({
  roomId,
  sessionId: _sessionId,
  enabled = true,
  iceServers = DEFAULT_ICE_SERVERS,
  defaultAudioInputMode = "hands_free",
  onPeerLeft,
  onTurnChange,
  onAISpeakingStateChange,
  onTranscriptUpdate,
}: UseSpeakingWebRTCOptions) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const remotePeerIdRef = useRef<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  // Compute WebSocket URL for room signaling & Gemini Live
  const wsUrl = useMemo(() => {
    if (!roomId || !enabled) return null

    const token = (typeof window !== "undefined" && localStorage.getItem("auth_token")) || ""
    let wsBase = config.wsUrl
    if (!wsBase) {
      const apiUrl = config.apiUrl || "/api/v1"
      if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
        wsBase = apiUrl.replace(/^http/, "ws")
      } else if (typeof window !== "undefined") {
        if (
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
          /^517\d$/.test(window.location.port)
        ) {
          wsBase = `ws://${window.location.hostname}:8000/api/v1`
        } else {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
          const cleanApi = apiUrl.startsWith("/") ? apiUrl : `/${apiUrl}`
          wsBase = `${protocol}//${window.location.host}${cleanApi}`
        }
      } else {
        wsBase = "ws://localhost:8000/api/v1"
      }
    }
    return `${wsBase}/speaking/ws/${roomId}?token=${encodeURIComponent(token)}`
  }, [roomId, enabled])

  // Callbacks ref
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

  // Initialize WebRTC Peer Connection (for teacher / peer practice)
  const createPeerConnection = useCallback(() => {
    if (typeof RTCPeerConnection === "undefined") {
      return null
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && engine.wsRef.current && engine.wsRef.current.readyState === WebSocket.OPEN) {
        const msg: SignalingEnvelope = {
          action: "ice_candidate",
          target_id: remotePeerIdRef.current || undefined,
          data: { candidate: event.candidate.toJSON() },
        }
        engine.sendMessage(msg as unknown as Record<string, unknown>)
      }
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (event.track.kind === "audio") {
          setRemoteStream(event.streams[0])
        }
      }
    }

    if (engine.localStreamRef.current) {
      engine.localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, engine.localStreamRef.current!)
      })
    }

    pcRef.current = pc
    return pc
  }, [iceServers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle incoming signaling messages for WebRTC peer negotiation
  const handleCustomMessage = useCallback(
    async (envelope: Record<string, unknown>) => {
      const action = envelope.action as string
      const sender_id = envelope.sender_id as string | undefined
      const data = envelope.data as Record<string, unknown> | undefined
      const cbs = callbacksRef.current

      if (action === "connected") {
        createPeerConnection()
      } else if (action === "participant_joined") {
        remotePeerIdRef.current = sender_id || null
        if (pcRef.current) {
          try {
            const offer = await pcRef.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: false,
            })
            await pcRef.current.setLocalDescription(offer)
            engine.sendMessage({
              action: "offer",
              target_id: sender_id,
              data: { sdp: offer.sdp, type: offer.type },
            })
          } catch (e) {
            console.warn("[useSpeakingWebRTC] Offer creation failed:", e)
          }
        }
      } else if (action === "offer") {
        remotePeerIdRef.current = sender_id || null
        if (pcRef.current && data?.sdp) {
          try {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({
                sdp: data.sdp as string,
                type: data.type as RTCSdpType,
              })
            )
            const answer = await pcRef.current.createAnswer()
            await pcRef.current.setLocalDescription(answer)
            engine.sendMessage({
              action: "answer",
              target_id: sender_id,
              data: { sdp: answer.sdp, type: answer.type },
            })
          } catch (e) {
            console.warn("[useSpeakingWebRTC] Answer creation failed:", e)
          }
        }
      } else if (action === "answer") {
        if (pcRef.current && data?.sdp) {
          try {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({
                sdp: data.sdp as string,
                type: data.type as RTCSdpType,
              })
            )
          } catch (e) {
            console.warn("[useSpeakingWebRTC] Set remote description failed:", e)
          }
        }
      } else if (action === "ice_candidate") {
        if (pcRef.current && data?.candidate) {
          try {
            await pcRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate as RTCIceCandidateInit)
            )
          } catch (e) {
            console.warn("[useSpeakingWebRTC] Add ICE candidate failed:", e)
          }
        }
      } else if (action === "participant_left") {
        remotePeerIdRef.current = null
        setRemoteStream(null)
        if (cbs.onPeerLeft) cbs.onPeerLeft()
      }
    },
    [createPeerConnection] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Unified duplex audio engine handling all microphone capture, bleed gating, PTT, and Gemini Live streaming
  const engine = useDuplexAudioEngine({
    wsUrl,
    enabled,
    defaultAudioInputMode,
    acousticBleedThreshold: 15,
    onAISpeakingStateChange: (state) => {
      if (callbacksRef.current.onAISpeakingStateChange) {
        callbacksRef.current.onAISpeakingStateChange(state)
      }
    },
    onTurnChange: (turn) => {
      if (callbacksRef.current.onTurnChange) {
        callbacksRef.current.onTurnChange(turn)
      }
    },
    onTranscript: (entry) => {
      if (callbacksRef.current.onTranscriptUpdate) {
        const displayRole = entry.role === "examiner" ? "Examinateur" : "Candidat"
        callbacksRef.current.onTranscriptUpdate(`${displayRole} : ${entry.text}`)
      }
    },
    onCustomMessage: handleCustomMessage,
    autoConnect: true,
  })

  // Synchronize transcript update callback when engine's liveTranscript changes
  useEffect(() => {
    if (engine.liveTranscript && callbacksRef.current.onTranscriptUpdate) {
      callbacksRef.current.onTranscriptUpdate(engine.liveTranscript)
    }
  }, [engine.liveTranscript])

  // Full cleanup including WebRTC peer connection
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    remotePeerIdRef.current = null
    setRemoteStream(null)
    engine.cleanup()
  }, [engine])

  const audioHealthStatus: AudioHealthStatus =
    engine.hasMicPermission === false
      ? "permission_denied"
      : engine.hasMicPermission
      ? "ready"
      : "permission_required"

  return {
    connectionState: engine.connectionState,
    isMuted: engine.isMuted,
    hasMicPermission: engine.hasMicPermission,
    audioHealthStatus,
    micLevel: engine.micLevel,
    remoteStream,
    isReconnecting: engine.isReconnecting,
    error: engine.error,
    aiState: engine.aiState,
    activeTurn: engine.activeTurn,
    liveTranscript: engine.liveTranscript,
    audioInputMode: engine.audioInputMode,
    setAudioInputMode: engine.setAudioInputMode,
    isPttActive: engine.isPttActive,
    togglePtt: engine.togglePtt,
    requestMicPermission: engine.requestMicPermission,
    resumeAudioContext: engine.resumeAudioContext,
    toggleMute: engine.toggleMute,
    reconnect: engine.connect,
    cleanup,
  }
}
