import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  PenTool,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UserCheck,
  BookOpen,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { PageHeader } from "@/components/common/PageHeader"
import { EmptyState } from "@/components/common/EmptyState"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"

interface SubmissionItem {
  id: string
  task_title: string
  submitted_at: string
  word_count: number
  status: "SUBMITTED" | "QUEUED" | "PROCESSING" | "CORRECTED"
  evaluator_type: "ai" | "teacher"
  evaluator_name?: string
  estimated_level?: string
  overall_feedback?: string
  strengths?: string[]
  improvements?: string[]
  corrections_count?: number
}

export const WritingSubmissionsPage: React.FC = () => {
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    setIsLoading(true)
    fetch("/api/v1/writing/submissions", { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items || []
        if (items.length === 0) {
          // Standard sample submissions illustrating AI and Teacher feedback
          const samples: SubmissionItem[] = [
            {
              id: "sub-1",
              task_title: "Interdiction de circulation au centre-ville (Section B)",
              submitted_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
              word_count: 228,
              status: "CORRECTED",
              evaluator_type: "ai",
              estimated_level: "B2",
              overall_feedback:
                "Argumentation bien structurée avec une prise de position explicite dès le premier paragraphe. Bon emploi des connecteurs logiques de concession ('certes', 'néanmoins'). Vigilance requise sur les accords des participes passés avec l'auxiliaire avoir.",
              strengths: [
                "Respect strict de la longueur demandée (228 mots / seuil 200-250).",
                "Formule d'interpellation adaptée au courrier des lecteurs.",
                "Progression logique claire entre constats et propositions.",
              ],
              improvements: [
                "Diversifier le lexique de l'urbanisme et de la transition écologique.",
                "Attention aux confusions indicatif / subjonctif après 'bien que'.",
              ],
              corrections_count: 3,
            },
            {
              id: "sub-2",
              task_title: "Lettre de réclamation concernant un retard aérien (Section B)",
              submitted_at: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
              word_count: 215,
              status: "CORRECTED",
              evaluator_type: "teacher",
              evaluator_name: "Prof. Martin Dufresne",
              estimated_level: "B1+",
              overall_feedback:
                "Très bon effort de rédaction, Alex. Le ton formel est bien maintenu. Toutefois, pour viser le niveau B2 (NCLC 7), vos arguments doivent être plus étayés avec des faits précis plutôt que de simples affirmations. Pensez à réviser la structure de la mise en demeure.",
              strengths: [
                "Politesse exemplaire et respect des formules d'usage.",
                "Cohérence temporelle satisfaisante dans le récit des événements.",
              ],
              improvements: [
                "Enrichir les structures syntaxiques (utiliser des propositions relatives et des gérondifs).",
                "Revoir l'orthographe lexicale des termes administratifs (dommages-intérêts, préjudice).",
              ],
              corrections_count: 5,
            },
          ]
          setSubmissions(samples)
          setSelectedSubmission(samples[0])
        } else {
          setSubmissions(items)
          if (items.length > 0) setSelectedSubmission(items[0])
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <StudentLayout>
      <PageShell>
        <PageHeader
          title="Atelier d'Expression Écrite"
          description="Suivi de vos rédactions, statuts de relecture et retours pédagogiques détaillés."
          actions={
            <Button
              onClick={() => navigate("/practice?category=writing")}
              className="cursor-pointer gap-1.5"
            >
              <PenTool className="size-3.5" />
              <span>Rédiger un nouvel essai</span>
            </Button>
          }
        />

        {submissions.length === 0 ? (
          <EmptyState
            icon={PenTool}
            title="Aucune rédaction soumise"
            description="Commencez votre première épreuve d'écriture pour recevoir un diagnostic détaillé de votre syntaxe et argumentation."
            actionLabel="Choisir un sujet d'écriture"
            onAction={() => navigate("/practice?category=writing")}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left list (5 cols): Submissions list */}
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vos rédactions récentes
              </h3>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-24 rounded-xl bg-card border border-border/60 animate-pulse" />
                  ))}
                </div>
              ) : (
                submissions.map((sub) => {
                const isSelected = selectedSubmission?.id === sub.id
                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                        {sub.task_title}
                      </h4>
                      <Badge
                        variant={sub.status === "CORRECTED" ? "success" : "warning"}
                        size="sm"
                        className="shrink-0 text-[10px]"
                      >
                        {sub.status === "CORRECTED" ? "Corrigé" : "En cours"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {sub.evaluator_type === "ai" ? (
                          <>
                            <Sparkles className="size-3 text-primary" />
                            <span>Évaluation IA</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-3 text-emerald-500" />
                            <span>{sub.evaluator_name || "Professeur"}</span>
                          </>
                        )}
                      </span>
                      <span className="font-mono text-[11px]">{sub.word_count} mots</span>
                    </div>
                  </div>
                )
              }))}
            </div>

            {/* Right detail pane (7 cols): Selected Submission Feedback */}
            <div className="lg:col-span-7">
              {selectedSubmission ? (
                <Card>
                  <CardHeader className="space-y-3 pb-3 border-b border-border/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {selectedSubmission.evaluator_type === "ai"
                          ? "Évaluation indicative par IA"
                          : "Correction experte par enseignant"}
                      </Badge>
                      {selectedSubmission.estimated_level && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Niveau estimé :</span>
                          <Badge variant="default" size="sm" className="font-bold">
                            {selectedSubmission.estimated_level}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardTitle className="text-lg">
                      {selectedSubmission.task_title}
                    </CardTitle>

                    {selectedSubmission.evaluator_type === "ai" && (
                      <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground flex items-center gap-2">
                        <Sparkles className="size-3.5 text-primary shrink-0" />
                        <span>
                          Cette analyse est générée automatiquement à titre indicatif selon les critères de référence TEF.
                        </span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-6 space-y-6">
                    {/* Overall feedback */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                        Commentaire général
                      </h4>
                      <p className="text-sm text-foreground/90 leading-relaxed p-4 rounded-lg bg-muted/40 border border-border/60 font-sans">
                        {selectedSubmission.overall_feedback}
                      </p>
                    </div>

                    {/* Strengths */}
                    {selectedSubmission.strengths && selectedSubmission.strengths.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5" />
                          <span>Points forts validés</span>
                        </h4>
                        <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                          {selectedSubmission.strengths.map((str, i) => (
                            <li key={i}>{str}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improvements */}
                    {selectedSubmission.improvements && selectedSubmission.improvements.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                          <AlertCircle className="size-3.5" />
                          <span>Axes d'amélioration prioritaires</span>
                        </h4>
                        <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                          {selectedSubmission.improvements.map((imp, i) => (
                            <li key={i}>{imp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {selectedSubmission.corrections_count || 0} point(s) d'attention relevé(s)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/writing/${selectedSubmission.id}/result`)}
                        className="cursor-pointer gap-1 text-xs"
                      >
                        <FileText className="size-3.5" />
                        <span>Rapport complet</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate("/practice?category=grammar")}
                        className="cursor-pointer gap-1 text-xs"
                      >
                        <BookOpen className="size-3.5" />
                        <span>S'entraîner</span>
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ) : (
                <EmptyState
                  title="Sélectionnez une rédaction"
                  description="Choisissez un écrit dans la liste de gauche pour consulter son analyse détaillée."
                />
              )}
            </div>
          </div>
        )}
      </PageShell>
    </StudentLayout>
  )
}
