/**
 * Hook for bidirectional full-duplex live audio communication with virtual TEF examiner in Admin AI Sandbox.
 * Powered by the unified useDuplexAudioEngine for acoustic bleed gating, PTT controls, and Gemini Live streaming.
 */

import { useCallback, useState } from "react"
import { config } from "@/core/config"
import { useDuplexAudioEngine, type LiveTranscriptEntry } from "./useDuplexAudioEngine"
import type { AudioInputMode } from "./types"

export interface TefReportCard {
  score: number
  tef_points: number
  cefr_level: string
  pronunciation_fluency: number
  lexical_resource: number
  grammatical_accuracy: number
  interaction_coherence: number
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  examiner_feedback: string
}

export interface AudioQueueItem {
  sourceNode: AudioBufferSourceNode
  scheduledTime: number
}

export type { LiveTranscriptEntry }

export interface LiveSessionOptions {
  wsUrl?: string
  scenarioId?: string
  topic?: string
  level?: string
  model?: string
  voicePersona?: string
  scepticismLevel?: number
  systemPrompt?: string
  temperature?: number
  topP?: number
  token?: string
  forceSimulation?: boolean
}

export function useLiveAudioSession(defaultAudioInputMode: AudioInputMode = "hands_free") {
  const [activeWsUrl, setActiveWsUrl] = useState<string | null>(null)
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
  const [isStarting, setIsStarting] = useState<boolean>(false)
  const [reportCard, setReportCard] = useState<TefReportCard | null>(null)
  const [isEndingExam, setIsEndingExam] = useState<boolean>(false)

  // Message handler for admin-specific events (e.g. report_card)
  const handleCustomMessage = useCallback((msg: Record<string, unknown>) => {
    const msgType = (msg.type || msg.action) as string
    if (msgType === "report_card" && msg.data) {
      setReportCard(msg.data as TefReportCard)
      setIsEndingExam(false)
    }
  }, [])

  // Delegate audio capture, acoustic bleed gating, PTT, and Gemini transport to unified engine
  const engine = useDuplexAudioEngine({
    wsUrl: activeWsUrl,
    enabled: isSessionActive,
    defaultAudioInputMode,
    acousticBleedThreshold: 15,
    onCustomMessage: handleCustomMessage,
    autoConnect: true,
  })

  // Start live sandbox session
  const startSession = useCallback(
    async (options: LiveSessionOptions = {}) => {
      setIsStarting(true)
      setReportCard(null)

      try {
        let wsUrl = options.wsUrl
        if (!wsUrl) {
          let wsBase: string = config.wsUrl
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
                const loc = window.location
                const proto = loc.protocol === "https:" ? "wss:" : "ws:"
                wsBase = `${proto}//${loc.host}${apiUrl.startsWith("/") ? "" : "/"}${apiUrl}`
              }
            } else {
              wsBase = "ws://localhost:8000/api/v1"
            }
          }

          const query = new URLSearchParams()
          if (options.token) query.set("token", options.token)
          if (options.scenarioId) query.set("scenario_id", options.scenarioId)
          if (options.topic) query.set("topic", options.topic)
          if (options.level) query.set("level", options.level)
          query.set("model", options.model || "models/gemini-3.8-live")
          if (options.voicePersona) query.set("voice_persona", options.voicePersona)
          if (options.scepticismLevel !== undefined)
            query.set("scepticism_level", String(options.scepticismLevel))
          if (options.systemPrompt) query.set("system_prompt", options.systemPrompt)
          if (options.temperature !== undefined)
            query.set("temperature", String(options.temperature))
          if (options.topP !== undefined) query.set("top_p", String(options.topP))
          if (options.forceSimulation) query.set("force_simulation", "true")

          wsUrl = `${wsBase}/admin/ai-sandbox/speaking/live-ws?${query.toString()}`
        }

        setActiveWsUrl(wsUrl)
        setIsSessionActive(true)
      } finally {
        setIsStarting(false)
      }
    },
    []
  )

  // Stop live session
  const stopSession = useCallback(() => {
    setIsSessionActive(false)
    setActiveWsUrl(null)
    engine.cleanup()
  }, [engine])

  // End exam and request final TEF report card from Gemini evaluator
  const endExamAndGetReport = useCallback(() => {
    setIsEndingExam(true)
    engine.sendMessage({
      type: "end_exam",
      action: "end_exam",
    })
  }, [engine])

  return {
    isConnecting: isStarting || engine.connectionState === "connecting",
    isConnected: engine.connectionState === "connected",
    isMuted: engine.isMuted,
    isExaminerSpeaking: engine.isExaminerSpeaking,
    isCandidateSpeaking: engine.isCandidateSpeaking,
    candidateVolume: engine.candidateVolume,
    examinerVolume: engine.examinerVolume,
    micLevel: engine.micLevel,
    transcripts: engine.transcripts,
    reportCard,
    isEndingExam,
    interruptionCount: engine.interruptionCount,
    audioChunksSent: engine.audioChunksSent,
    error: engine.error,
    audioInputMode: engine.audioInputMode,
    setAudioInputMode: engine.setAudioInputMode,
    isPttActive: engine.isPttActive,
    togglePtt: engine.togglePtt,
    startSession,
    stopSession,
    triggerInterruption: engine.triggerInterruption,
    toggleMute: engine.toggleMute,
    endExamAndGetReport,
    sendTextMessage: engine.sendTextMessage,
  }
}
