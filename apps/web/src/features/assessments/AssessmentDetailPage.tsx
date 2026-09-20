import React, { useContext, useMemo } from "react"
import { useParams, useNavigate, useLocation, Link } from "react-router-dom"
import {
  QueryClient,
  QueryClientProvider,
  QueryClientContext,
} from "@tanstack/react-query"
import {
  ChevronRight,
  Headphones,
  BookOpen,
  Layers,
  Sparkles,
  HelpCircle,
  Award,
} from "lucide-react"
import { PageShell } from "@/components/layout/PageShell"
import { StudentLayout } from "@/features/dashboard/StudentLayout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorState } from "@/components/common/ErrorState"
import { AssessmentSummary } from "./AssessmentSummary"
import { AssessmentOverview } from "./AssessmentOverview"
import { AssessmentSections } from "./AssessmentSections"
import { AssessmentSkills } from "./AssessmentSkills"
import { AssessmentRules } from "./AssessmentRules"
import { AssessmentHistoryPreview } from "./AssessmentHistoryPreview"
import { AssessmentPrimaryAction } from "./AssessmentPrimaryAction"
import { AssessmentDetailsSkeleton } from "./AssessmentDetailsSkeleton"
import {
  useAssessmentDetail,
  AuthRequiredError,
  AssessmentNotFoundError,
} from "./useAssessmentDetail"

export interface AssessmentDetailPageProps {
  assessmentId?: string
}

const AssessmentDetailPageInner: React.FC<AssessmentDetailPageProps> = ({
  assessmentId: propId,
}) => {
  const params = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const assessmentId = useMemo(() => {
    if (propId) return propId
    if (params.id) return params.id
    const match = location.pathname.match(/\/assessments\/([^/?#]+)/)
    return match ? match[1] : undefined
  }, [propId, params.id, location.pathname])

  const {
    assessment,
    activeAttempt,
    lastAttempt,
    recommendation,
    totalQuestions,
    isLoading,
    isStarting,
    actionError,
    isNotFoundError,
    isAuthError,
    error,
    refetch,
    startAttempt,
  } = useAssessmentDetail(assessmentId)

  const handleStart = async () => {
    try {
      const attempt = await startAttempt()
      navigate(`/attempts/${attempt.id}`)
    } catch {
      // Error handled inside hook and displayed in actionError
    }
  }

  const handleResume = (attemptId: string) => {
    navigate(`/attempts/${attemptId}`)
  }

  const isAuth =
    isAuthError ||
    error instanceof AuthRequiredError ||
    (error as any)?.name === "AuthRequiredError" ||
    (error as any)?.message === "AUTH_REQUIRED"

  const isNotFound =
    isNotFoundError ||
    error instanceof AssessmentNotFoundError ||
    (error as any)?.name === "AssessmentNotFoundError" ||
    (error as any)?.message?.includes("introuvable")

  // Handle Authentication Session Expiration
  if (isAuth) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <ErrorState
            title="Session expirée"
            description="Votre session a expiré ou une authentification est requise pour accéder aux détails de cette épreuve."
            actionLabel="Se reconnecter"
            onAction={() => {
              try {
                localStorage.removeItem("auth_token")
              } catch {
                // Ignore sandbox error
              }
              navigate("/login")
            }}
          />
        </PageShell>
      </StudentLayout>
    )
  }

  // Handle Not Found Error
  if (isNotFound || (!isLoading && !assessment && !isAuth)) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <ErrorState
            title="Cette évaluation n'est plus disponible"
            description="L'épreuve demandée est introuvable ou a été archivée."
            actionLabel="Retour aux simulations"
            onAction={() => navigate("/assessments")}
          />
        </PageShell>
      </StudentLayout>
    )
  }

  // Handle Generic Error
  if (error && !assessment) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <ErrorState
            title="Impossible de charger cette évaluation"
            description={(error as any)?.message || "Une erreur est survenue lors de la récupération des détails de l'épreuve."}
            actionLabel="Réessayer"
            onRetry={refetch}
          />
        </PageShell>
      </StudentLayout>
    )
  }

  if (isLoading || !assessment) {
    return (
      <StudentLayout>
        <PageShell maxWidth="default">
          <AssessmentDetailsSkeleton />
        </PageShell>
      </StudentLayout>
    )
  }

  const isListening = assessment.assessment_type === "listening"
  const isReading = assessment.assessment_type === "reading"
  const TypeIcon = isListening ? Headphones : isReading ? BookOpen : Layers
  const typeLabel = isListening
    ? "Compréhension orale"
    : isReading
    ? "Compréhension écrite"
    : "Simulation complète"

  return (
    <StudentLayout>
      <PageShell maxWidth="default">
        <div className="space-y-8">
          {/* Header & Breadcrumb Trail */}
          <div className="space-y-4 pb-6 border-b border-border/60">
            <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link to="/dashboard" className="hover:text-foreground transition-colors">
                Accueil
              </Link>
              <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
              <Link to="/assessments" className="hover:text-foreground transition-colors">
                Simulations TEF
              </Link>
              <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
              <span className="font-medium text-foreground">
                Consigne de l'épreuve
              </span>
            </nav>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={isListening ? "default" : isReading ? "secondary" : "outline"}
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                >
                  <TypeIcon className="size-3.5" />
                  <span>{typeLabel}</span>
                </Badge>

                <Badge variant="outline" size="sm" className="font-mono text-xs font-semibold">
                  <Award className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Niveau {assessment.level || "B2"}</span>
                </Badge>

                {assessment.pass_percentage && (
                  <Badge variant="outline" size="sm" className="font-mono text-[11px] text-muted-foreground">
                    Seuil de validation : {Math.round(assessment.pass_percentage * 100)}%
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {assessment.title}
              </h1>

              <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                {assessment.description ||
                  "Simulation officielle TEF sous conditions réelles et chronométrage strict."}
              </p>
            </div>
          </div>

          {/* Contextual Pedagogical Rationale (if recommended) */}
          {recommendation && (
            <Card className="border-primary/40 bg-gradient-to-r from-primary/10 via-card to-card shadow-2xs">
              <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
                <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="size-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <HelpCircle className="size-3.5" />
                    <span>Pourquoi cette évaluation vous est recommandée ?</span>
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {recommendation.reason}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Metadata Row */}
          <AssessmentSummary
            assessment={assessment}
            totalQuestions={totalQuestions}
          />

          {/* Main 2-Column Layout on Desktop, 1-Column with Top CTA on Mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Main Column: Details, Sections, Skills, Rules */}
            <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
              <AssessmentOverview assessment={assessment} />

              <AssessmentSections
                sections={assessment.sections}
                assessmentType={assessment.assessment_type}
              />

              <AssessmentSkills
                assessmentType={assessment.assessment_type}
              />

              <AssessmentRules assessment={assessment} />
            </div>

            {/* Sidebar Column: CTA & History Preview (order-1 on mobile, order-2 on desktop) */}
            <div className="lg:col-span-1 space-y-6 order-1 lg:order-2 lg:sticky lg:top-20">
              <AssessmentPrimaryAction
                assessment={assessment}
                activeAttempt={activeAttempt}
                lastAttempt={lastAttempt}
                isStarting={isStarting}
                actionError={actionError}
                onStart={handleStart}
                onResume={handleResume}
              />

              <AssessmentHistoryPreview lastAttempt={lastAttempt} />
            </div>
          </div>
        </div>
      </PageShell>
    </StudentLayout>
  )
}

export const AssessmentDetailPage: React.FC<AssessmentDetailPageProps> = (props) => {
  const existingClient = useContext(QueryClientContext)

  const fallbackClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 60 * 1000,
          },
        },
      }),
    []
  )

  if (!existingClient) {
    return (
      <QueryClientProvider client={fallbackClient}>
        <AssessmentDetailPageInner {...props} />
      </QueryClientProvider>
    )
  }

  return <AssessmentDetailPageInner {...props} />
}
