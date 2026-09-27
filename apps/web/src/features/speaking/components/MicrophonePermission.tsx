import { Mic, AlertCircle, ShieldAlert, CheckCircle2, Radio, Headphones } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import type { AudioInputMode } from "../types"

export interface MicrophonePermissionProps {
  hasPermission: boolean | null
  onRequestPermission: () => Promise<boolean>
  onContinue: () => void
  isChecking?: boolean
  audioInputMode?: AudioInputMode
  onAudioInputModeChange?: (mode: AudioInputMode) => void
}

export function MicrophonePermission({
  hasPermission,
  onRequestPermission,
  onContinue,
  isChecking = false,
  audioInputMode = "hands_free",
  onAudioInputModeChange,
}: MicrophonePermissionProps) {
  return (
    <Card className="max-w-md w-full mx-auto border-border shadow-sm">
      <CardHeader className="text-center pb-2">
        <div className="size-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
          <Mic className="size-6" />
        </div>
        <CardTitle className="text-lg">
          {hasPermission === false
            ? "Autorisation microphone refusée"
            : "Accès au microphone requis"}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-xs text-muted-foreground text-center">
        {hasPermission === null && (
          <p className="leading-relaxed">
            Votre microphone est indispensable pour évaluer votre expression orale TEF.
            Veuillez autoriser l'accès lorsque votre navigateur vous le demande.
          </p>
        )}

        {hasPermission === true && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2 font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Microphone activé et validé</span>
            </div>

            {onAudioInputModeChange && (
              <div className="text-left space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-foreground block">
                  Mode de capture audio :
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => onAudioInputModeChange("hands_free")}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      audioInputMode === "hands_free"
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Headphones className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-xs text-foreground">Mains libres (Continu)</p>
                      <p className="text-[11px] text-muted-foreground">Idéal avec un casque ou des écouteurs.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onAudioInputModeChange("push_to_talk")}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      audioInputMode === "push_to_talk"
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Radio className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-xs text-foreground">Push-to-Talk (Touche T)</p>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-semibold">Haut-parleurs</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Activez le micro avec [T] pour parler sans aucun écho.</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {hasPermission === false && (
          <div className="space-y-3 text-left p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold">Comment réactiver votre microphone :</p>
                <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                  <li>Cliquez sur l'icône de cadenas ou de réglages à gauche de la barre d'adresse de votre navigateur.</li>
                  <li>Activez l'autorisation pour le <strong>Microphone</strong>.</li>
                  <li>Rechargez la page pour appliquer la modification.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <div className="p-2.5 rounded-md bg-muted/40 border border-border text-[11px] flex items-start gap-2 text-left">
          <ShieldAlert className="size-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            <strong>Confidentialité garantie :</strong> Le flux audio est utilisé exclusivement pour la simulation en temps réel. Aucune vidéo n'est requise.
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2">
        {hasPermission !== true ? (
          <Button
            onClick={onRequestPermission}
            disabled={isChecking}
            className="w-full cursor-pointer font-semibold gap-1.5"
          >
            <Mic className="size-4" />
            <span>{isChecking ? "Vérification..." : "Autoriser le microphone"}</span>
          </Button>
        ) : (
          <Button
            onClick={onContinue}
            className="w-full cursor-pointer font-semibold"
          >
            Rejoindre la session
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
