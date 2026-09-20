import { useState } from "react"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface SpeakingTranscriptProps {
  transcript?: string | null
  className?: string
}

export function SpeakingTranscript({ transcript, className }: SpeakingTranscriptProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  if (!transcript) {
    return null
  }

  return (
    <div className={`w-full max-w-xl mx-auto rounded-xl border border-border/70 bg-card/60 overflow-hidden ${className || ""}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FileText className="size-3.5 text-primary" />
          <span className="font-semibold uppercase tracking-wider">Transcription indicative</span>
        </div>
        {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </Button>

      {isExpanded && (
        <div className="p-4 pt-1 border-t border-border/40 text-xs text-foreground/80 leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
          {transcript}
        </div>
      )}
    </div>
  )
}
