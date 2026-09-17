/**
 * Full student learning loop dashboard view.
 */

import React from "react";
import {
  Target,
  AlertTriangle,
  BookOpen,
  PenLine,
  Mic,
  Calendar,
  Sparkles,
  ArrowRight,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { useStudentDashboard } from "./useDashboard";
import { SkillMetricCard } from "./SkillMetricCard";
import { HistoricalProgressChart } from "./HistoricalProgressChart";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { Button } from "@/components/ui/button";

export const StudentDashboardPage: React.FC = () => {
  const { dashboard, progress, isLoading, isError, error, refetch } =
    useStudentDashboard();

  const [loginEmail, setLoginEmail] = React.useState("student.demo@example.com");
  const [loginPassword, setLoginPassword] = React.useState("DemoStudent2026!");
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleLogin = async (emailOverride?: string, passwordOverride?: string) => {
    setIsSubmitting(true);
    setAuthError(null);
    const email = emailOverride || loginEmail;
    const password = passwordOverride || loginPassword;

    try {
      const resp = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        // If demo user is missing on initial login, auto-register them
        if (resp.status === 401 && email.includes("demo")) {
          const regResp = await fetch("/api/v1/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password,
              role: "student",
            }),
          });
          if (regResp.ok) {
            const regData = await regResp.json();
            localStorage.setItem("auth_token", regData.access_token);
            refetch();
            return;
          }
        }
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error?.message || "Identifiants de connexion invalides.");
      }

      const data = await resp.json();
      localStorage.setItem("auth_token", data.access_token);
      refetch();
    } catch (err: any) {
      setAuthError(err.message || "Erreur de connexion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Render friendly authentication form if unauthorized
  if (isError && error?.message === "AUTH_REQUIRED") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border border-indigo-500/20 bg-slate-900/80 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-indigo-500/10 text-indigo-400 mb-2">
              <Target className="size-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Tableau de bord Étudiant</h2>
            <p className="text-sm text-slate-400">
              Veuillez vous connecter pour accéder à votre profil, vos scores et vos recommandations TEF.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs text-center">
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="nom@exemple.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mot de passe</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••••••"
              />
            </div>

            <Button
              onClick={() => handleLogin()}
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {isSubmitting ? "Connexion..." : "Se connecter"}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">ou</span>
              </div>
            </div>

            <Button
              onClick={() => handleLogin("student.demo@example.com", "DemoStudent2026!")}
              disabled={isSubmitting}
              variant="outline"
              className="w-full border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="size-4 text-indigo-400" />
              Connexion Rapide (Compte Démo Étudiant)
            </Button>
          </div>

          <div className="pt-2 text-center">
            <a href="/" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
              &larr; Retour à l'accueil
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto my-12 rounded-xl border border-rose-500/20 bg-rose-500/5">
        <AlertTriangle className="size-12 text-rose-400 mb-3" />
        <h2 className="text-xl font-bold text-white">Erreur de chargement</h2>
        <p className="mt-2 text-sm text-slate-400">
          {error instanceof Error
            ? error.message
            : "Impossible de charger les données du tableau de bord."}
        </p>
        <Button
          onClick={() => refetch()}
          className="mt-6 inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white"
        >
          <RotateCcw className="size-4" /> Réessayer
        </Button>
      </div>
    );
  }

  const isEmpty =
    dashboard.skills.length === 0 &&
    dashboard.recent_assessments.length === 0 &&
    dashboard.recent_writing_corrections.length === 0 &&
    dashboard.recent_speaking_sessions.length === 0;

  if (isEmpty) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <DashboardEmptyState
          studentName={dashboard.student_name}
          targetExam={dashboard.target_exam}
          targetLevel={dashboard.target_level}
          onStartDiagnostic={() => {
            window.location.href = "/assessments";
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* 1. Header with Target Level & Exam */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Bonjour, {dashboard.student_name}
            </h1>
            <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              {dashboard.target_exam}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Suivi personnalisé de votre préparation et de la boucle d'apprentissage.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 backdrop-blur-md">
            <Target className="size-5 text-indigo-400" />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Niveau cible
              </div>
              <div className="text-base font-bold text-white">
                {dashboard.target_level}
              </div>
            </div>
          </div>

          {dashboard.overall_readiness !== null && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                  Préparation estimée
                </div>
                <div className="text-base font-bold text-emerald-400">
                  {dashboard.overall_readiness}%
                </div>
              </div>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.removeItem("auth_token");
              refetch();
            }}
            className="text-xs border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
          >
            Déconnexion
          </Button>
        </div>
      </header>

      {/* 2. Weakest Skills Callout Banner (if identified) */}
      {dashboard.weakest_skills.length > 0 && (
        <section
          data-testid="weakest-skills-banner"
          className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-300">
                Points de vigilance identifiés par le moteur pédagogique
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Vos résultats récents indiquent une priorité de renforcement sur ces compétences clés :
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {dashboard.weakest_skills.map((ws) => (
                  <span
                    key={ws.skill_id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/60 px-2.5 py-1 text-xs font-medium text-amber-200"
                  >
                    <span>{ws.skill_name}</span>
                    <span className="font-bold text-amber-400">
                      ({ws.mastery_score}%)
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Current Estimated Skill Profile */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Profil de compétences estimé
            </h2>
            <p className="text-xs text-slate-400">
              Score actuel, mesure précédente, delta d'évolution et indice de confiance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboard.skills.map((metric) => (
            <SkillMetricCard key={metric.skill_id} metric={metric} />
          ))}
        </div>
      </section>

      {/* 4. Recommended Exercises & Learning Loop */}
      {dashboard.recommended_exercises.length > 0 && (
        <section data-testid="recommended-exercises-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="size-5 text-indigo-400" /> Recommandations ciblées
              </h2>
              <p className="text-xs text-slate-400">
                Exercices générés de manière déterministe pour combler vos lacunes
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {dashboard.recommended_exercises.map((rec) => (
              <div
                key={rec.id}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md transition-colors hover:border-indigo-500/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        rec.priority === "critical"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : rec.priority === "high"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      Priorité {rec.priority}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      Niveau {rec.level}
                    </span>
                  </div>

                  <h3 className="mt-3 font-semibold text-white">{rec.title}</h3>
                  <p className="mt-1 text-xs text-slate-300 italic">
                    « {rec.reason} »
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Compétence cible :{" "}
                    <span className="text-indigo-300 font-medium">
                      {rec.target_skill_name}
                    </span>
                  </p>
                </div>

                <div className="mt-4 border-t border-white/5 pt-3">
                  <Button
                    size="sm"
                    className="w-full justify-between bg-indigo-600 hover:bg-indigo-500 text-white"
                    onClick={() => {
                      window.location.href = `/exercises/${rec.id}`;
                    }}
                  >
                    <span>Commencer cet exercice</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Progress Over Time: Immutable Timeline */}
      <section>
        <HistoricalProgressChart timeline={progress?.timeline || []} />
      </section>

      {/* 6. Multi-Modal Recent Activity Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Standard Assessments */}
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="size-4 text-blue-400" />
            <h3 className="font-semibold text-white">Épreuves récentes</h3>
          </div>
          {dashboard.recent_assessments.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun test passé récemment.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.recent_assessments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-white/5 bg-slate-950/40 p-3 flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200 line-clamp-1">
                      {a.title}
                    </p>
                    <span className="text-xs text-slate-400">
                      Niveau estimé : {a.estimated_level}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-white">
                      {a.score_percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Writing Corrections */}
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <PenLine className="size-4 text-amber-400" />
            <h3 className="font-semibold text-white">Rédactions & Corrections</h3>
          </div>
          {dashboard.recent_writing_corrections.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune rédaction soumise.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.recent_writing_corrections.map((w) => (
                <div
                  key={w.id}
                  className="rounded-lg border border-white/5 bg-slate-950/40 p-3 flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200 line-clamp-1">
                      {w.task_title}
                    </p>
                    <span className="text-xs text-slate-400 capitalize">
                      Statut : {w.status}
                    </span>
                  </div>
                  <div className="text-right">
                    {w.overall_score !== null ? (
                      <span className="font-bold text-sm text-amber-400">
                        {w.overall_score}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">En attente</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Teacher Bookings & Speaking */}
        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="size-4 text-indigo-400" />
            <h3 className="font-semibold text-white">Réservations & Oral</h3>
          </div>
          {dashboard.upcoming_bookings.length === 0 &&
          dashboard.recent_speaking_sessions.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune session réservée.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.upcoming_bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-white/5 bg-slate-950/40 p-3 flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Professeur : {b.teacher_name}
                    </p>
                    <span className="text-xs text-indigo-300">
                      {new Date(b.start_time).toLocaleString("fr-FR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {b.meeting_link && (
                    <a
                      href={b.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      Lien <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))}
              {dashboard.recent_speaking_sessions.map((spk) => (
                <div
                  key={spk.id}
                  className="rounded-lg border border-white/5 bg-slate-950/40 p-3 flex justify-between items-center"
                >
                  <div className="flex items-center gap-2">
                    <Mic className="size-3.5 text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-200 capitalize">
                        Session {spk.session_type}
                      </p>
                      <span className="text-xs text-slate-400">
                        Niveau : {spk.estimated_level || "Évalué"}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-emerald-400">
                    {spk.overall_score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
