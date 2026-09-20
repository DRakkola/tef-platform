import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Mic,
  Play,
  Calendar,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { PageHeader } from "@/components/common/PageHeader"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"

import { useSpeakingSession } from "./useSpeakingSession"
import { useSpeakingWebRTC } from "./useSpeakingWebRTC"
import { createSpeakingSession, listSpeakingSessions } from "./api"
import type { SpeakingSession } from "./types"

import {
  FocusedSpeakingShell,
  SpeakingTopBar,
  ReconnectingBanner,
  MicrophonePermission,
  SpeakingParticipant,
  SpeakingPrompt,
  SpeakingTurnIndicator,
  SpeakingControls,
  SpeakingTranscript,
  LeaveSpeakingDialog,
  SpeakingSessionComplete,
  SpeakingSkeleton,
} from "./components"

export const SpeakingSessionPage: React.FC = () => {
  const { sessionId: paramSessionId, id: paramId } = useParams<{
    sessionId?: string
    id?: string
  }>()
  const sessionId = paramSessionId || paramId
  const navigate = useNavigate()

  // State for session launcher when on /speaking
  const [sessionsList, setSessionsList] = useState<SpeakingSession[]>([])
  const [isListing, setIsListing] = useState<boolean>(!sessionId)
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [selectedSection, setSelectedSection] = useState<"A" | "B">("A")
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState<boolean>(false)

  // 1. Session Lifecycle Hook
  const {
    session,
    isLoading,
    error: sessionError,
    remainingSeconds,
    workspaceState,
    evaluation,
    currentPromptIndex,
    startSession,
    completeSession,
    nextPrompt,
  } = useSpeakingSession({
    sessionId,
  })

  // 2. WebRTC & Audio Hook
  const {
    connectionState,
    isMuted,
    hasMicPermission,
    micLevel,
    isReconnecting,
    aiState,
    activeTurn,
    requestMicPermission,
    toggleMute,
    reconnect,
    cleanup,
  } = useSpeakingWebRTC({
    roomId: session?.room_id,
    sessionId: session?.id,
    iceServers: session?.ice_servers,
  })

  // Load existing sessions if on launcher (/speaking)
  useEffect(() => {
    if (!sessionId) {
      listSpeakingSessions()
        .then((res) => {
          setSessionsList(res.items || [])
          setIsListing(false)
        })
        .catch(() => {
          setIsListing(false)
        })
    }
  }, [sessionId])

  // Handle starting a new AI session from launcher
  const handleCreateAISession = async () => {
    try {
      setIsCreating(true)
      const topic =
        selectedSection === "A"
          ? "TEF Expression Orale — Section A (Prise d'information formelle)"
          : "TEF Expression Orale — Section B (Argumentation et conviction)"

      const newSession = await createSpeakingSession({
        session_type: "ai",
        topic,
        level: "B2",
        duration_minutes: 25,
      })

      navigate(`/speaking/sessions/${newSession.id}`)
    } catch {
      setIsCreating(false)
    }
  }

  // Handle confirming leave
  const handleConfirmLeave = () => {
    cleanup()
    setIsLeaveDialogOpen(false)
    navigate("/speaking")
  }

  // ==========================================
  // VIEW 1: LAUNCHER / SESSIONS HUB (/speaking)
  // ==========================================
  if (!sessionId) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <div className="space-y-6">
            <PageHeader
              title="Speaking Workspace"
              description="Entraînez-vous à l'épreuve d'Expression Orale TEF avec un examinateur virtuel IA ou un professeur certifié."
              backHref="/dashboard"
              backLabel="Tableau de bord"
            />

            {/* Quick Start Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-2 rounded-full bg-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Nouvelle Simulation
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    Niveau B2 · 25 min
                  </Badge>
                </div>
                <CardTitle className="text-lg pt-1">
                  Simulation Immédiate d'Expression Orale
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Lancez un entretien en conditions réelles avec notre Examinateur Virtuel TEF.
                  L'audio est transmis en temps réel via WebRTC sans aucune vidéo requise.
                </p>

                {/* Section selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSection("A")}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedSection === "A"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">Section A · Renseignements</span>
                      <Badge variant="outline" className="text-[10px]">10 min</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Poser une dizaine de questions formelles pour obtenir des informations détaillées sur une annonce.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSection("B")}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedSection === "B"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">Section B · Conviction</span>
                      <Badge variant="outline" className="text-[10px]">15 min</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Convaincre un ami ou proche d'adhérer à votre proposition en structurant vos arguments.
                    </p>
                  </button>
                </div>
              </CardContent>

              <CardFooter className="border-t border-border/60 pt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mic className="size-3.5 text-primary" />
                  Microphone requis · Zéro vidéo
                </span>
                <Button
                  onClick={handleCreateAISession}
                  disabled={isCreating}
                  className="cursor-pointer gap-2 font-semibold"
                >
                  <Play className="size-4" />
                  <span>{isCreating ? "Création..." : "Démarrer la simulation (25 min)"}</span>
                </Button>
              </CardFooter>
            </Card>

            {/* Existing / Scheduled Sessions */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <span>Vos sessions récentes et planifiées</span>
              </h3>

              {isListing ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Chargement de vos sessions...
                </div>
              ) : sessionsList.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Aucune session récente. Cliquez sur "Démarrer la simulation" ci-dessus pour vous entraîner.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sessionsList.map((s) => (
                    <Card
                      key={s.id}
                      className="border-border/80 hover:border-primary/40 transition-colors"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={s.status === "active" ? "success" : "outline"}
                            className="text-[10px]"
                          >
                            {s.status === "active"
                              ? "En cours"
                              : s.status === "completed"
                                ? "Terminé"
                                : s.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {s.session_type === "ai" ? "IA" : "Professeur"}
                          </span>
                        </div>
                        <CardTitle className="text-sm line-clamp-1 pt-1">
                          {s.topic}
                        </CardTitle>
                      </CardHeader>
                      <CardFooter className="pt-2 border-t border-border/40 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {s.duration_minutes} min
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/speaking/sessions/${s.id}`)}
                          className="cursor-pointer text-xs h-7"
                        >
                          {s.status === "active" || s.status === "scheduled"
                            ? "Rejoindre"
                            : "Voir détails"}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PageShell>
      </StudentLayout>
    )
  }

  // ==========================================
  // VIEW 2: LOADING SKELETON
  // ==========================================
  if (isLoading) {
    return (
      <FocusedSpeakingShell
        topBar={
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between animate-pulse">
            <div className="h-4 w-32 bg-muted rounded-md" />
            <div className="h-4 w-24 bg-muted rounded-md" />
          </div>
        }
      >
        <SpeakingSkeleton />
      </FocusedSpeakingShell>
    )
  }

  // ==========================================
  // VIEW 3: ERROR / NOT FOUND
  // ==========================================
  if (sessionError || !session) {
    return (
      <FocusedSpeakingShell
        topBar={
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
            <span className="font-semibold text-xs text-muted-foreground">Speaking</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/speaking")}
              className="text-xs cursor-pointer"
            >
              Retour
            </Button>
          </div>
        }
      >
        <div className="p-8 text-center max-w-md mx-auto space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive">
          <AlertCircle className="size-8 mx-auto text-destructive" />
          <div className="space-y-1">
            <h3 className="text-base font-bold">Erreur de chargement</h3>
            <p className="text-xs text-muted-foreground">
              {sessionError || "Session orale introuvable ou inaccessible."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/speaking")}
            className="cursor-pointer text-xs"
          >
            Retour à l'accueil Speaking
          </Button>
        </div>
      </FocusedSpeakingShell>
    )
  }

  // ==========================================
  // VIEW 4: COMPLETED / EXPIRED STATE
  // ==========================================
  if (workspaceState === "submitted" || session.status === "completed" || session.status === "expired") {
    return (
      <FocusedSpeakingShell
        topBar={
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
            <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary">
              Speaking · Bilan
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-xs cursor-pointer"
            >
              Quitter
            </Button>
          </div>
        }
      >
        <SpeakingSessionComplete
          evaluation={evaluation}
          isExpired={session.status === "expired"}
          onRestart={() => navigate("/speaking")}
        />
      </FocusedSpeakingShell>
    )
  }

  // ==========================================
  // VIEW 5: PRE-SESSION MICROPHONE CHECK
  // ==========================================
  if (workspaceState === "preparing" || hasMicPermission !== true) {
    return (
      <FocusedSpeakingShell
        topBar={
          <div className="h-14 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary">
                Speaking · Préparation
              </Badge>
              <span className="text-xs text-muted-foreground truncate max-w-xs">{session.topic}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/speaking")}
              className="text-xs cursor-pointer"
            >
              Quitter
            </Button>
          </div>
        }
      >
        <div className="w-full space-y-6">
          <MicrophonePermission
            hasPermission={hasMicPermission}
            onRequestPermission={requestMicPermission}
            onContinue={async () => {
              await startSession()
            }}
          />
        </div>
      </FocusedSpeakingShell>
    )
  }

  // ==========================================
  // VIEW 6: ACTIVE SPEAKING WORKSPACE
  // ==========================================
  const teacherParticipant = session.participants.find((p) => p.role === "teacher")

  return (
    <FocusedSpeakingShell
      topBar={
        <SpeakingTopBar
          title={session.topic}
          sessionType={session.session_type}
          connectionState={connectionState}
          isReconnecting={isReconnecting}
          isMuted={isMuted}
          remainingSeconds={remainingSeconds}
          onToggleMute={toggleMute}
          onLeaveClick={() => setIsLeaveDialogOpen(true)}
        />
      }
      reconnectBanner={
        isReconnecting ? <ReconnectingBanner onRetry={reconnect} /> : undefined
      }
    >
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        {/* Main Prompt / Question Area */}
        <SpeakingPrompt
          topic={session.topic}
          level={session.level}
          currentQuestion={currentPromptIndex + 1}
          totalQuestions={1}
          objective="Écoutez attentivement votre interlocuteur. Répondez avec précision en structurant vos propos."
          context={session.session_type === "ai" ? "Simulateur d'entretien TEF" : "Séance avec professeur certifié"}
        />

        {/* Turn-taking Indicator (AI Mode Only) */}
        <SpeakingTurnIndicator
          sessionType={session.session_type}
          activeTurn={activeTurn}
          isMicMuted={isMuted}
        />

        {/* Participant Audio Card */}
        <SpeakingParticipant
          sessionType={session.session_type}
          participant={teacherParticipant}
          aiState={aiState}
          activeTurn={activeTurn}
          isRemoteSpeaking={connectionState === "connected" && !isMuted}
        />

        {/* Optional Collapsible Transcript */}
        <SpeakingTranscript transcript={null} />

        {/* Primary Controls & Audio Meter */}
        <SpeakingControls
          isMuted={isMuted}
          micLevel={micLevel}
          onToggleMute={toggleMute}
          onLeaveClick={() => setIsLeaveDialogOpen(true)}
          onCompleteClick={completeSession}
          onNextPrompt={nextPrompt}
        />

        {/* Leave Confirmation Dialog */}
        <LeaveSpeakingDialog
          isOpen={isLeaveDialogOpen}
          onClose={() => setIsLeaveDialogOpen(false)}
          onConfirmLeave={handleConfirmLeave}
          isTeacherSession={session.session_type === "teacher"}
        />
      </div>
    </FocusedSpeakingShell>
  )
}
