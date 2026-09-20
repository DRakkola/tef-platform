import React, { useEffect, useRef, useState, useCallback } from "react"
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ListeningAudioStatus } from "./ListeningAudioStatus"
import { ListeningPlaybackProgress } from "./ListeningPlaybackProgress"
import { telemetry } from "@/features/analytics/telemetry"
import { cn } from "@/lib/utils"
import type { AudioPlaybackState, AudioPlaybackRules } from "../types"

export interface ListeningPlayerProps {
  mediaUrl?: string | null
  title?: string
  playbackRules?: AudioPlaybackRules
  isExamExpired?: boolean
  isExamSubmitted?: boolean
  onPlaybackStart?: () => void
  onPlaybackEnd?: () => void
  onPlaybackError?: () => void
  className?: string
}

export const ListeningPlayer: React.FC<ListeningPlayerProps> = ({
  mediaUrl,
  title = "Document sonore d'évaluation",
  playbackRules,
  isExamExpired = false,
  isExamSubmitted = false,
  onPlaybackStart,
  onPlaybackEnd,
  onPlaybackError,
  className,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Extract playback policy rules with official TEF defaults
  const allowPause = playbackRules?.allow_pause ?? true
  const allowSeek = playbackRules?.allow_seek ?? false
  const allowReplay = playbackRules?.allow_replay ?? false
  const maxReplays = playbackRules?.max_replays ?? 1
  const autoplay = playbackRules?.autoplay ?? false

  // Internal audio state
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>(
    mediaUrl ? "idle" : "unavailable"
  )
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [playCount, setPlayCount] = useState<number>(0)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const isCompleted = playCount >= maxReplays && !allowReplay
  const playsRemaining = Math.max(0, maxReplays - playCount)
  const canPlay = !isCompleted && !isExamExpired && !isExamSubmitted

  // 1. Reset or initialize on mediaUrl change
  useEffect(() => {
    if (!mediaUrl) {
      setPlaybackState("unavailable")
      return
    }

    setPlaybackState("idle")
    setCurrentTime(0)
    setDuration(0)
    setPlayCount(0)

    // Handle browser autoplay policy gracefully if requested
    if (autoplay && audioRef.current) {
      setPlaybackState("loading")
      audioRef.current
        .play()
        .then(() => {
          setPlaybackState("playing")
          telemetry.track("listening_audio_started", { mediaUrl })
          onPlaybackStart?.()
        })
        .catch(() => {
          // Autoplay rejected by browser media policy -> gracefully drop back to idle
          setPlaybackState("idle")
        })
    }
  }, [mediaUrl, autoplay, onPlaybackStart])

  // 2. Stop audio immediately if exam expires or is submitted
  useEffect(() => {
    if (isExamExpired || isExamSubmitted) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setPlaybackState("ended")
    }
  }, [isExamExpired, isExamSubmitted])

  // 3. Audio Cleanup on unmount
  useEffect(() => {
    const audioEl = audioRef.current
    return () => {
      if (audioEl) {
        audioEl.pause()
        audioEl.src = ""
      }
    }
  }, [])

  // 4. Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !mediaUrl || isExamExpired || isExamSubmitted) return

    if (playbackState === "playing") {
      if (!allowPause) return // Pause not permitted by rule
      audioRef.current.pause()
      setPlaybackState("paused")
      setAnnouncement("Audio mis en pause.")
    } else {
      if (!canPlay) return

      setPlaybackState("loading")
      audioRef.current
        .play()
        .then(() => {
          setPlaybackState("playing")
          setAnnouncement("Lecture de l'enregistrement audio en cours.")
          if (playCount === 0) {
            telemetry.track("listening_audio_started", { mediaUrl })
            onPlaybackStart?.()
          } else {
            telemetry.track("listening_audio_replayed", { mediaUrl, playCount })
          }
        })
        .catch(() => {
          setPlaybackState("error")
          setAnnouncement("Impossible de lancer la lecture audio.")
          onPlaybackError?.()
        })
    }
  }, [
    playbackState,
    allowPause,
    canPlay,
    mediaUrl,
    isExamExpired,
    isExamSubmitted,
    playCount,
    onPlaybackStart,
    onPlaybackError,
  ])

  // 5. Replay handler (when permitted)
  const handleReplay = useCallback(() => {
    if (!audioRef.current || !canPlay || !allowReplay) return
    audioRef.current.currentTime = 0
    setCurrentTime(0)
    audioRef.current
      .play()
      .then(() => {
        setPlaybackState("playing")
        setAnnouncement("Réécoute de l'audio depuis le début.")
        telemetry.track("listening_audio_replayed", { mediaUrl, playCount })
      })
      .catch(() => {
        setPlaybackState("error")
      })
  }, [canPlay, allowReplay, mediaUrl, playCount])

  // 6. Media Event Listeners
  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return
    setDuration(audioRef.current.duration || 0)
    if (playbackState === "loading") {
      setPlaybackState("idle")
    }
  }

  const handleEnded = () => {
    setPlaybackState("ended")
    setPlayCount((prev) => prev + 1)
    setAnnouncement("Enregistrement audio terminé.")
    telemetry.track("listening_audio_completed", { mediaUrl })
    onPlaybackEnd?.()
  }

  const handleError = () => {
    setPlaybackState("error")
    setAnnouncement("Erreur lors du chargement de l'enregistrement audio.")
    telemetry.track("listening_audio_error", { mediaUrl })
    onPlaybackError?.()
  }

  const handleSeek = (newTime: number) => {
    if (!audioRef.current || !allowSeek) return
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleRetry = () => {
    if (!audioRef.current || !mediaUrl) return
    setPlaybackState("loading")
    audioRef.current.load()
    audioRef.current
      .play()
      .then(() => {
        setPlaybackState("playing")
      })
      .catch(() => {
        setPlaybackState("error")
      })
  }

  if (!mediaUrl) {
    return (
      <Card className="border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        <ListeningAudioStatus status="unavailable" />
      </Card>
    )
  }

  return (
    <Card
      role="region"
      aria-label="Lecteur audio de l'évaluation"
      className={cn(
        "border-border/80 bg-card p-5 sm:p-6 shadow-sm rounded-2xl transition-colors space-y-4",
        className
      )}
    >
      {/* Underlying HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={mediaUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        muted={isMuted}
        preload="metadata"
      />

      {/* Screen-reader Live Region Announcement */}
      {announcement && (
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      )}

      {/* Top Row: Audio Title & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allowReplay
              ? `Réécoute autorisée (${playsRemaining} restante${playsRemaining > 1 ? "s" : ""})`
              : "Écoute unique strictement encadrée"}
          </p>
        </div>

        <ListeningAudioStatus status={playbackState} onRetry={handleRetry} />
      </div>

      {/* Middle Row: Playback Progress (Elapsed / Duration) */}
      <ListeningPlaybackProgress
        currentTime={currentTime}
        duration={duration}
        allowSeek={allowSeek}
        onSeek={handleSeek}
      />

      {/* Bottom Row: Controls */}
      <div className="flex items-center justify-between pt-1 gap-3">
        <div className="flex items-center gap-2.5">
          {/* Main Play / Pause Button */}
          <Button
            type="button"
            onClick={togglePlay}
            disabled={!canPlay && playbackState !== "playing"}
            size="lg"
            className={cn(
              "cursor-pointer font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl gap-2 shadow-xs transition-all",
              playbackState === "playing"
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            aria-label={
              playbackState === "playing"
                ? "Mettre en pause l'écoute"
                : currentTime > 0
                ? "Reprendre l'écoute audio"
                : "Lancer l'écoute de l'enregistrement"
            }
          >
            {playbackState === "playing" ? (
              allowPause ? (
                <>
                  <Pause className="size-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Volume2 className="size-4 animate-pulse" />
                  <span>En écoute...</span>
                </>
              )
            ) : (
              <>
                <Play className="size-4 fill-current" />
                <span>{currentTime > 0 ? "Reprendre l'écoute" : "Lancer l'écoute"}</span>
              </>
            )}
          </Button>

          {/* Replay Button (Only rendered if replay is permitted by content rules) */}
          {allowReplay && playCount > 0 && playsRemaining > 0 && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleReplay}
              className="cursor-pointer text-xs sm:text-sm h-11 px-4 rounded-xl gap-1.5"
              aria-label="Réécouter le document audio depuis le début"
            >
              <RotateCcw className="size-3.5" />
              <span>Réécouter ({playsRemaining})</span>
            </Button>
          )}
        </div>

        {/* Mute / Unmute Button */}
        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className="size-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 flex items-center justify-center transition-colors cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={isMuted ? "Activer le son du document audio" : "Couper le son"}
        >
          {isMuted ? <VolumeX className="size-4 text-destructive" /> : <Volume2 className="size-4" />}
        </button>
      </div>
    </Card>
  )
}
