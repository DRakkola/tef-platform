/**
 * useWritingResult Hook.
 * State management and data synchronization for the Writing Result & Correction Experience.
 * Handles fetching attempt results, polling pending corrections, loading recommendations,
 * and firing privacy-safe telemetry events.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { telemetry } from "@/features/analytics/telemetry"
import type {
  WritingResultDetail,
  WritingRecommendation,
} from "./types"

export interface UseWritingResultReturn {
  result: WritingResultDetail | null
  recommendations: WritingRecommendation[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  isPending: boolean
  isCorrected: boolean
  refetch: () => Promise<void>
}

// Robust fallback data for demo/testing when backend is unconfigured or in development
const FALLBACK_RESULTS: Record<string, WritingResultDetail> = {
  "demo-attempt": {
    attempt_id: "demo-attempt",
    submission_id: "demo-sub",
    status: "corrected",
    word_count: 228,
    submitted_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    task: {
      id: "w-1",
      title: "Expression Écrite — Section B (Lettre d'opinion formelle)",
      task_type: "section_b",
      prompt:
        "Vous avez lu dans un journal que la mairie de votre ville souhaite interdire totalement la circulation automobile dans le centre-ville dès l'année prochaine. Vous écrivez au courrier des lecteurs pour exprimer votre point de vue argumenté sur ce projet en présentant des avantages, des inconvénients et des propositions concrètes d'aménagement.",
      stimulus_text: null,
      min_words: 200,
      max_words: 250,
      duration_minutes: 60,
      target_level: "B2",
    },
    content:
      "Monsieur le Rédacteur en chef,\n\n" +
      "Je me permets de vous adresser cette lettre afin d'exprimer mon point de vue concernant le projet d'interdiction totale des véhicules dans notre centre-ville.\n\n" +
      "D'un côté, une telle mesure permettrait indéniablement de réduire la pollution atmosphérique et sonore, tout en favorisant la convivialité et la sécurité des piétons. De nombreuses métropoles européennes ont déjà franchi le pas avec succès.\n\n" +
      "Cependant, une interdiction brutale risque de pénaliser lourdement les commerçants de proximité et d'isoler les personnes âgées ou à mobilité réduite qui dépendent de leur voiture pour accéder aux services essentiels. De plus, le réseau de transports en commun actuel n'est pas encore suffisamment cadencé pour absorber ce flux supplémentaire.\n\n" +
      "Par conséquent, il me semblerait plus judicieux d'adopter une transition progressive : aménager d'abord de grands parkings relais gratuits en périphérie, renforcer les lignes de tramway et instaurer des plages horaires réservées aux livraisons avant d'envisager une fermeture complète.\n\n" +
      "En espérant que ces suggestions nourriront la réflexion collective, je vous prie d'agréer, Monsieur, mes salutations distinguées.",
    correction: {
      id: "corr-demo",
      submission_id: "demo-sub",
      provider: "ai",
      status: "returned",
      score: 78.0,
      estimated_level: "B2",
      task_completion: 85.0,
      coherence: 80.0,
      vocabulary: 75.0,
      grammar: 72.0,
      syntax: 75.0,
      spelling: 85.0,
      register: 80.0,
      strengths: [
        "Structure épistolaire exemplaire avec formules d'appel et de prise de congé formelles adéquates.",
        "Excellente progression argumentative articulée avec des connecteurs variés ('D'un côté', 'Cependant', 'Par conséquent').",
        "Volume textuel parfaitement conforme à la consigne (228 mots / fourchette 200–250).",
      ],
      weaknesses: [
        "Quelques confusions modales : privilégiez le conditionnel présent pour formuler des propositions d'aménagement prudentes.",
        "Précision lexicale perfectible concernant le vocabulaire de l'urbanisme et de la mobilité durable.",
      ],
      comments:
        "Excellente copie d'entraînement. Votre lettre est claire, polie et bien argumentée. Vous présentez des arguments équilibrés (avantages et inconvénients) avant de proposer une alternative constructive. Avec un travail ciblé sur la variété lexicale et les structures hypothétiques complexes, vous consoliderez facilement le niveau B2/C1.",
      corrected_content: null,
      recommendations: [
        "Pratiquez l'expression de l'hypothèse et de la nuance au subjonctif et au conditionnel.",
        "Enrichissez votre vocabulaire thématique lié à la transition écologique et aux transports collectifs.",
      ],
      items: [
        {
          id: "item-1",
          correction_id: "corr-demo",
          original_text: "concernant le projet d'interdiction",
          corrected_text: "à propos du projet d'interdiction",
          category: "vocabulary",
          explanation:
            "Bien que 'concernant' soit correct, 'à propos de' ou 'au sujet de' apporte une touche plus élégante et naturelle dans une lettre ouverte formelle.",
          skill_id: "sk-vocab-formal",
          created_at: new Date().toISOString(),
        },
        {
          id: "item-2",
          correction_id: "corr-demo",
          original_text: "il me semblerait plus judicieux",
          corrected_text: "il apparaîtrait plus judicieux",
          category: "register",
          explanation:
            "L'emploi d'une tournure impersonnelle ('il apparaîtrait') renforce l'objectivité de votre proposition face à la mairie.",
          skill_id: "sk-syntax-impersonal",
          created_at: new Date().toISOString(),
        },
        {
          id: "item-3",
          correction_id: "corr-demo",
          original_text: "nourriront la réflexion collective",
          corrected_text: "nourriront le débat public",
          category: "vocabulary",
          explanation:
            "Dans le contexte d'une tribune dans un journal, 'nourrir le débat public' est la colocation journalistique standard en français de niveau B2/C1.",
          skill_id: "sk-vocab-collocations",
          created_at: new Date().toISOString(),
        },
      ],
      skills: [
        {
          id: "cs-1",
          correction_id: "corr-demo",
          skill_id: "sk-coherence",
          score: 80.0,
          level: "B2",
          feedback: "Progression logique claire et transitions fluides.",
          created_at: new Date().toISOString(),
        },
        {
          id: "cs-2",
          correction_id: "corr-demo",
          skill_id: "sk-grammar",
          score: 72.0,
          level: "B2",
          feedback: "Bonne maîtrise globale des accords et des temps.",
          created_at: new Date().toISOString(),
        },
      ],
      is_simulated: true,
      disclaimer: "Score d'entraînement indicatif — Non officiel TEF.",
      created_at: new Date().toISOString(),
    },
    is_simulated: true,
    disclaimer: "Score d'entraînement indicatif — Non officiel TEF.",
  },
}

export function useWritingResult(attemptId: string | undefined): UseWritingResultReturn {
  const [result, setResult] = useState<WritingResultDetail | null>(null)
  const [recommendations, setRecommendations] = useState<WritingRecommendation[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef<boolean>(true)

  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  const authHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // 1. Fetch Recommendations
  const fetchRecommendations = useCallback(async () => {
    try {
      const resp = await fetch("/api/v1/students/me/recommendations", {
        headers: authHeaders,
        credentials: "include",
      })
      if (resp.ok) {
        const data = await resp.json()
        const items = Array.isArray(data) ? data : data.items || []
        const mapped: WritingRecommendation[] = items.map((r: any) => ({
          id: r.id || r.entity_id || String(Math.random()),
          skill_id: r.skill_id,
          skill_name: r.skill_name || r.title || "Compétence ciblée",
          skill_code: r.skill_code,
          category: r.category || "Grammaire",
          level: r.level || "B2",
          title: r.title || r.skill_name || "Exercice recommandé",
          reason: r.reason || "Renforcez les notions identifiées lors de cette correction.",
          action_url: r.entity_id ? `/exercises/${r.entity_id}` : `/practice?category=${r.category || "writing"}`,
          action_label: "S'entraîner",
        }))
        if (mapped.length > 0) {
          setRecommendations(mapped)
          return
        }
      }
    } catch {
      // Non-blocking for recommendation engine
    }

    // Default recommendations based on writing skills if student recommendation engine returns empty
    setRecommendations([
      {
        id: "rec-def-1",
        skill_name: "Connecteurs logiques et argumentation",
        category: "Grammaire",
        level: "B2",
        title: "Maîtriser les connecteurs de concession (bien que, néanmoins, certes)",
        reason: "Renforcez la fluidité et la nuance de votre argumentation pour le TEF.",
        action_url: "/practice?category=grammar",
        action_label: "S'entraîner",
      },
      {
        id: "rec-def-2",
        skill_name: "Formules formelles et épistolaires",
        category: "Vocabulaire",
        level: "B2",
        title: "Les formules d'appel et de prise de congé dans la correspondance administrative",
        reason: "Perfectionnez le registre soutenu requis pour la Section B.",
        action_url: "/practice?category=vocabulary",
        action_label: "Revoir la leçon",
      },
      {
        id: "rec-def-3",
        skill_name: "L'hypothèse et le conditionnel",
        category: "Conjugaison",
        level: "B2",
        title: "Exprimer des propositions modérées au conditionnel présent",
        reason: "Adoptez les tournures diplomatiques attendues par les examinateurs.",
        action_url: "/practice?category=grammar",
        action_label: "5 exercices ciblés",
      },
    ])
  }, [])

  // 2. Fetch Writing Result
  const fetchResult = useCallback(
    async (isManualRefresh = false) => {
      if (!attemptId) return

      if (isManualRefresh) {
        setIsRefreshing(true)
      } else if (!result) {
        setIsLoading(true)
      }
      setError(null)

      try {
        let resultData: WritingResultDetail | null = null

        // Try direct attempt result endpoint
        const resp = await fetch(`/api/v1/writing/attempts/${attemptId}/result`, {
          headers: authHeaders,
          credentials: "include",
        })

        if (resp.ok) {
          resultData = await resp.json()
        } else if (resp.status === 404) {
          // Fallback: Check if attemptId is actually a submissionId
          const subResp = await fetch(`/api/v1/writing/submissions/${attemptId}`, {
            headers: authHeaders,
            credentials: "include",
          })
          if (subResp.ok) {
            const subData = await subResp.json()
            resultData = {
              attempt_id: subData.attempt_id || subData.id,
              submission_id: subData.id,
              status: subData.status,
              word_count: subData.word_count,
              submitted_at: subData.submitted_at,
              task: subData.task,
              content: subData.content,
              correction: subData.correction || null,
              is_simulated: true,
              disclaimer: "Score d'entraînement indicatif — Non officiel TEF.",
            }
          }
        }

        // Fallback for demo or offline test runs
        if (!resultData && FALLBACK_RESULTS[attemptId]) {
          resultData = FALLBACK_RESULTS[attemptId]
        }

        if (!resultData) {
          throw new Error("Résultat d'écriture introuvable ou indisponible.")
        }

        if (!isMountedRef.current) return

        setResult(resultData)

        // Telemetry tracking (never includes essay text)
        telemetry.track("writing_result_viewed", {
          attempt_id: resultData.attempt_id,
          submission_id: resultData.submission_id,
          status: resultData.status,
          provider: resultData.correction?.provider || "none",
          estimated_level: resultData.correction?.estimated_level || "pending",
        })

        // Check if we need to poll for pending corrections
        const isStillPending =
          !resultData.correction ||
          ["submitted", "queued", "assigned", "in_review", "processing", "reviewing"].includes(
            resultData.status.toLowerCase()
          )

        if (isStillPending) {
          if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current)
          pollingTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchResult(false)
            }
          }, 6000)
        } else {
          if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current)
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err.message || "Erreur de chargement du résultat.")
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [attemptId, result]
  )

  useEffect(() => {
    isMountedRef.current = true
    fetchResult(false)
    fetchRecommendations()

    return () => {
      isMountedRef.current = false
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current)
    }
  }, [attemptId])

  const isPending =
    !result?.correction ||
    ["submitted", "queued", "assigned", "in_review", "processing", "reviewing"].includes(
      (result?.status || "").toLowerCase()
    )

  const isCorrected =
    Boolean(result?.correction) &&
    ["corrected", "returned"].includes((result?.status || "").toLowerCase())

  return {
    result,
    recommendations,
    isLoading,
    isRefreshing,
    error,
    isPending,
    isCorrected,
    refetch: () => fetchResult(true),
  }
}
