import React, { useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw, Volume2, VolumeX, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ListeningPlayerProps {
  mediaUrl: string
  title?: string
  replayAllowed?: boolean
  maxPlays?: number
  onPlayStart?: () => void
  onPlayEnd?: () => void
  className?: string
}

export const ListeningPlayer: React.FC<ListeningPlayerProps> = ({
  mediaUrl,
  title = "Document sonore d'évaluation",
  replayAllowed = true,
  maxPlays = 1,
  onPlayStart,
  onPlayEnd,
  className,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playCount, setPlayCount] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

  const playsRemaining = Math.max(0, maxPlays - playCount)
  const canPlay = replayAllowed || playCount < maxPlays

  useEffect(() => {
    // Reset state on media change
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setPlayCount(0)
  }, [mediaUrl])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (!canPlay && currentTime === 0) return
      audioRef.current.play().then(() => {
        setIsPlaying(true)
        if (playCount === 0) {
          onPlayStart?.()
        }
      }).catch((err) => {
        console.warn("Audio play prevented:", err)
      })
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return
    setDuration(audioRef.current.duration)
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setPlayCount((prev) => prev + 1)
    onPlayEnd?.()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !replayAllowed) return
    const newTime = Number(e.target.value)
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "0:00"
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      data-slot="listening-player"
      className={cn(
        "rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-colors",
        className
      )}
    >
      <audio
        ref={audioRef}
        src={mediaUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        muted={isMuted}
        preload="metadata"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Volume2 className="size-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground tracking-tight">
              {title}
            </h4>
            <span className="text-xs text-muted-foreground">
              {replayAllowed
                ? "Écoute libre (réécoute autorisée)"
                : `Écoute unique strictement encadrée (${playsRemaining} restante)`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!replayAllowed && (
            <Badge variant={playCount >= maxPlays ? "destructive" : "warning"} size="sm">
              <AlertCircle className="size-3" />
              <span>{playCount >= maxPlays ? "Écoute terminée" : "1 seule écoute"}</span>
            </Badge>
          )}
          {replayAllowed && (
            <Badge variant="outline" size="sm">
              Réécoute disponible
            </Badge>
          )}
        </div>
      </div>

      {/* Scrubber and time */}
      <div className="space-y-1.5 mb-3">
        <div className="relative w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-100 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
          {replayAllowed && (
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Position dans l'enregistrement audio"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isPlaying ? "secondary" : "default"}
            size="sm"
            onClick={togglePlay}
            disabled={!canPlay && !isPlaying}
            className="cursor-pointer font-medium"
            aria-label={isPlaying ? "Mettre en pause l'audio" : "Lancer l'écoute audio"}
          >
            {isPlaying ? (
              <>
                <Pause className="size-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="size-4" />
                <span>{currentTime > 0 ? "Reprendre" : "Lancer l'écoute"}</span>
              </>
            )}
          </Button>

          {replayAllowed && playCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!audioRef.current) return
                audioRef.current.currentTime = 0
                setCurrentTime(0)
                audioRef.current.play()
                setIsPlaying(true)
              }}
              className="cursor-pointer"
              aria-label="Réécouter le document depuis le début"
            >
              <RotateCcw className="size-3.5" />
              <span>Recommencer</span>
            </Button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label={isMuted ? "Activer le son" : "Couper le son"}
        >
          {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
    </div>
  )
}
