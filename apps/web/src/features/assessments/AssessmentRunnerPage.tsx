import React, { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Send,
  HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorState } from "@/components/common/ErrorState"
import { cn } from "@/lib/utils"

interface QuestionOption {
  id: string
  content: string
  order_index: number
}

interface Question {
  id: string
  section_id: string
  prompt: string
  order_index: number
  level: string
  points: number
  media_url?: string | null
  options: QuestionOption[]
}

interface Section {
  id: string
  title: string
  instructions?: string | null
  order_index: number
  passage_text?: string | null
  media_url?: string | null
  questions: Question[]
}

interface AssessmentDetail {
  id: string
  title: string
  description?: string | null
  assessment_type: string
  duration_seconds: number
  sections: Section[]
}

interface AttemptAnswer {
  question_id: string
  selected_option_id?: string | null
}

interface AttemptDetail {
  id: string
  assessment_id: string
  status: string
  remaining_seconds: number
  answers: AttemptAnswer[]
}

interface AttemptResults {
  attempt_id: string
  score: {
    total_points: number
    max_points: number
    percentage: number
    is_passed: boolean
    estimated_level: string
  }
  sections: {
    id: string
    title: string
    passage_text?: string | null
    questions: {
      id: string
      prompt: string
      points: number
      explanation?: string | null
      options: {
        id: string
        content: string
        is_correct: boolean
      }[]
      user_answer?: {
        selected_option_id?: string | null
        is_correct?: boolean
      } | null
    }[]
  }[]
}

export const AssessmentRunnerPage: React.FC = () => {
  const { id: assessmentId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [results, setResults] = useState<AttemptResults | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({})
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  useEffect(() => {
    if (!assessmentId) return

    async function loadInitialData() {
      setIsLoading(true)
      setError(null)
      try {
        const asmtResp = await fetch(`/api/v1/assessments/${assessmentId}`, {
          credentials: "include",
          headers: authHeaders,
        })
        if (!asmtResp.ok) throw new Error("Épreuve introuvable.")
        const asmtData = await asmtResp.json()
        setAssessment(asmtData)
      } catch (err: any) {
        setError(err.message || "Erreur de chargement.")
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [assessmentId])

  const handleStartAttempt = async () => {
    if (!assessmentId) return
    setIsLoading(true)
    try {
      const resp = await fetch(`/api/v1/assessments/${assessmentId}/attempts`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      })
      if (!resp.ok) throw new Error("Impossible d'initialiser la tentative.")
      const data: AttemptDetail = await resp.json()
      setAttempt(data)
      setRemainingSeconds(data.remaining_seconds)

      const map: Record<string, string> = {}
      data.answers?.forEach((a) => {
        if (a.selected_option_id) map[a.question_id] = a.selected_option_id
      })
      setAnswersMap(map)
    } catch (err: any) {
      setError(err.message || "Erreur lors du démarrage.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (remainingSeconds === null || results) return

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [remainingSeconds, results])

  const handleSelectOption = async (questionId: string, optionId: string) => {
    if (!attempt || results) return

    setAnswersMap((prev) => ({ ...prev, [questionId]: optionId }))
    setSavingQuestionId(questionId)

    try {
      await fetch(`/api/v1/attempts/${attempt.id}/answers`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        body: JSON.stringify({
          question_id: questionId,
          selected_option_id: optionId,
        }),
      })
    } catch (err) {
      console.error("Erreur lors de l'enregistrement de la réponse", err)
    } finally {
      setSavingQuestionId(null)
    }
  }

  const handleSubmit = async () => {
    if (!attempt || isSubmitting) return
    setIsSubmitting(true)
    try {
      const resp = await fetch(`/api/v1/attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      })
      if (!resp.ok) throw new Error("Erreur de soumission.")
      const resultsData: AttemptResults = await resp.json()
      setResults(resultsData)
    } catch (err: any) {
      alert(err.message || "Impossible de soumettre l'épreuve.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Chargement de la session d'épreuve...</p>
        </div>
      </div>
    )
  }

  if (error || !assessment) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <ErrorState
          title="Impossible d'accéder à l'épreuve"
          description={error || "Épreuve introuvable."}
          actionLabel="Retour au tableau de bord"
          onRetry={() => navigate("/dashboard")}
        />
      </div>
    )
  }

  // View 1: Not started yet
  if (!attempt && !results) {
    const totalQuestions = assessment.sections.reduce((sum, s) => sum + s.questions.length, 0)

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6 antialiased">
        <Card className="max-w-2xl w-full border-border/80 bg-card shadow-xs">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center gap-2.5">
              <Badge variant="default" size="sm" className="uppercase font-mono text-[10px]">
                Simulation TEF - {assessment.assessment_type}
              </Badge>
              <Badge variant="outline" size="sm" className="font-mono text-xs text-muted-foreground">
                Durée : {Math.round(assessment.duration_seconds / 60)} minutes
              </Badge>
            </div>

            <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {assessment.title}
            </CardTitle>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {assessment.description || "Épreuve officielle de simulation sous conditions chronométrées strictes."}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/60 text-center rounded-xl bg-muted/20">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Nombre de sections</span>
                <p className="text-xl font-bold text-foreground">{assessment.sections.length}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Total questions</span>
                <p className="text-xl font-bold text-foreground">{totalQuestions}</p>
              </div>
            </div>

            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex gap-3 items-start">
              <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/90 leading-relaxed">
                <span className="font-semibold text-foreground">Règles de l'examen :</span> Le chronomètre fait autorité côté serveur. Dès que vous lancez l'épreuve, le temps s'écoule de façon irréversible. Vos réponses sont sauvegardées automatiquement au fur et à mesure.
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => navigate("/dashboard")}
                variant="outline"
                className="cursor-pointer text-xs"
              >
                Annuler
              </Button>
              <Button
                onClick={handleStartAttempt}
                className="flex-1 cursor-pointer font-semibold text-xs gap-2"
              >
                <span>Démarrer l'épreuve maintenant</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // View 2: Results View
  if (results) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 antialiased">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Score Banner */}
          <Card className="border-border/80 bg-card shadow-xs">
            <CardHeader className="space-y-4 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <Badge variant="outline" size="sm" className="gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="size-3" />
                    <span>Épreuve terminée et corrigée</span>
                  </Badge>
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-2">
                    {assessment.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Les résultats ont été intégrés à votre profil de compétences.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-center px-4 py-3 rounded-xl border border-border/80 bg-muted/30 min-w-[85px]">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Niveau CLB</span>
                    <div className="text-2xl font-black text-primary mt-0.5">{results.score.estimated_level}</div>
                  </div>

                  <div className="text-center px-4 py-3 rounded-xl border border-border/80 bg-muted/30 min-w-[85px]">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">Résultat</span>
                    <div className="text-2xl font-black text-foreground mt-0.5 font-mono">{Math.round(results.score.percentage)}%</div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex justify-end pt-2 border-t border-border/40">
              <Button
                onClick={() => navigate("/dashboard")}
                className="cursor-pointer gap-2 text-xs font-semibold"
              >
                <span>Accéder aux recommandations personnalisées</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* Detailed Question Review */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-foreground">Correction détaillée par section</h2>

            {results.sections.map((section, sIdx) => (
              <Card key={section.id} className="border-border/80 bg-card p-6 space-y-6 shadow-xs">
                <div className="border-b border-border/60 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Section {sIdx + 1}
                  </span>
                  <h3 className="text-base font-bold text-foreground mt-0.5">{section.title}</h3>
                </div>

                {section.passage_text && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-foreground/90 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-serif">
                    {section.passage_text}
                  </div>
                )}

                <div className="space-y-4">
                  {section.questions.map((q, qIdx) => {
                    const isCorrect = q.user_answer?.is_correct
                    return (
                      <div
                        key={q.id}
                        className={cn(
                          "rounded-xl border p-4 space-y-3 transition-colors",
                          isCorrect
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-destructive/30 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-sm text-foreground">
                            Q{qIdx + 1}. {q.prompt}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
                            {isCorrect ? (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="size-3.5" /> Correct (+{q.points} pts)
                              </span>
                            ) : (
                              <span className="text-destructive flex items-center gap-1">
                                <XCircle className="size-3.5" /> Incorrect (0/{q.points} pts)
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Options */}
                        <div className="mt-3 space-y-2">
                          {q.options.map((opt) => {
                            const isUserSelected = q.user_answer?.selected_option_id === opt.id
                            const isRight = opt.is_correct

                            return (
                              <div
                                key={opt.id}
                                className={cn(
                                  "text-xs px-3.5 py-2.5 rounded-lg border flex items-center justify-between",
                                  isRight
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-foreground font-semibold"
                                    : isUserSelected && !isRight
                                    ? "border-destructive/40 bg-destructive/15 text-foreground"
                                    : "border-border/60 bg-card text-muted-foreground"
                                )}
                              >
                                <span>{opt.content}</span>
                                <div className="flex items-center gap-2">
                                  {isUserSelected && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-foreground">
                                      Votre choix
                                    </span>
                                  )}
                                  {isRight && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                                      Bonne réponse
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="mt-3 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/60 flex gap-2 items-start">
                            <HelpCircle className="size-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-foreground">Explication : </span>
                              {q.explanation}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // View 3: Active Taking Session
  const activeSection = assessment.sections[currentSectionIndex] || assessment.sections[0]
  const totalQuestions = assessment.sections.reduce((sum, s) => sum + s.questions.length, 0)
  const answeredCount = Object.keys(answersMap).length

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Top Fixed Authoritative Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/90 backdrop-blur-md px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground truncate">{assessment.title}</h1>
            <p className="text-xs text-muted-foreground truncate">
              Section {currentSectionIndex + 1}/{assessment.sections.length} : {activeSection.title}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            {/* Server Authoritative Countdown */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs sm:text-sm font-bold shadow-2xs",
                (remainingSeconds || 0) < 300
                  ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                  : "border-border/80 bg-muted/50 text-foreground"
              )}
            >
              <Clock className="size-3.5 sm:size-4" />
              <span>{remainingSeconds !== null ? formatTimer(remainingSeconds) : "--:--"}</span>
            </div>

            {/* Answered progress */}
            <div className="hidden sm:block text-xs text-muted-foreground font-mono">
              <span className="font-semibold text-foreground">{answeredCount}</span> / {totalQuestions} répondues
            </div>

            {/* Submit Exam Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              size="sm"
              className="cursor-pointer font-semibold text-xs gap-1.5 rounded-xl"
            >
              <Send className="size-3.5" />
              <span>{isSubmitting ? "Validation..." : "Terminer et soumettre"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Taking Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Section Passage */}
        {activeSection.passage_text && (
          <Card className="border-border/80 bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Texte support
              </span>
            </CardHeader>
            <CardContent className="pt-4 text-sm text-foreground/90 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap pr-2 font-serif">
              {activeSection.passage_text}
            </CardContent>
          </Card>
        )}

        {/* Audio Player */}
        {activeSection.media_url && (
          <Card className="border-border/80 bg-card p-4 flex items-center gap-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">Document sonore :</span>
            <audio controls className="w-full h-8" src={activeSection.media_url}>
              Votre navigateur ne prend pas en charge la lecture audio.
            </audio>
          </Card>
        )}

        {/* Section Questions */}
        <div className="space-y-6">
          {activeSection.questions.map((question) => {
            const isSaved = answersMap[question.id] !== undefined
            const isSaving = savingQuestionId === question.id

            return (
              <Card key={question.id} className="border-border/80 bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                      <span className="text-primary mr-2 font-mono">Question {question.order_index} :</span>
                      {question.prompt}
                    </CardTitle>
                    <div className="text-xs shrink-0 flex items-center gap-1.5 font-medium">
                      {isSaving ? (
                        <span className="text-warning">Sauvegarde...</span>
                      ) : isSaved ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" /> Enregistré
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Non répondue</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5">
                  {question.options.map((option) => {
                    const isSelected = answersMap[question.id] === option.id

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectOption(question.id, option.id)}
                        className={cn(
                          "w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-medium shadow-2xs ring-1 ring-primary/30"
                            : "border-border/80 bg-card text-foreground/90 hover:border-border hover:bg-muted/40"
                        )}
                      >
                        <div
                          className={cn(
                            "size-4 rounded-full border flex items-center justify-center shrink-0",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          )}
                        >
                          {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm leading-normal">{option.content}</span>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Bottom Section Paging */}
        <div className="flex justify-between items-center pt-6 border-t border-border/60">
          <Button
            onClick={() => setCurrentSectionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentSectionIndex === 0}
            variant="outline"
            size="sm"
            className="text-xs cursor-pointer gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Section précédente</span>
          </Button>

          <span className="text-xs text-muted-foreground font-mono">
            Section {currentSectionIndex + 1} sur {assessment.sections.length}
          </span>

          <Button
            onClick={() =>
              setCurrentSectionIndex((prev) => Math.min(assessment.sections.length - 1, prev + 1))
            }
            disabled={currentSectionIndex === assessment.sections.length - 1}
            variant="outline"
            size="sm"
            className="text-xs cursor-pointer gap-1.5"
          >
            <span>Section suivante</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </main>
    </div>
  )
}
