/**
 * LoginPage component: Clean, academic authentication portal.
 * Supports sign-in, account creation, and 1-click dev demo credentials.
 */

import React, { useState } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  UserCheck,
  ShieldCheck,
} from "lucide-react"
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "./AuthContext"

export interface LoginPageProps {
  initialTab?: "login" | "register"
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialTab = "login" }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, isAuthenticated, user } = useAuth()

  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [targetExam, setTargetExam] = useState("TEF Canada")
  const [targetLevel, setTargetLevel] = useState("B2")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect destination
  const from = (location.state as any)?.from?.pathname || (user?.role === "admin" ? "/admin" : "/dashboard")

  // If already authenticated, redirect immediately
  React.useEffect(() => {
    if (isAuthenticated && !isSubmitting) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, isSubmitting, navigate, from])

  // Demo shortcut fills
  const fillDemoStudent = () => {
    setEmail("student.demo@example.com")
    setPassword("DemoStudent2026!")
    setErrorMsg(null)
  }

  const fillDemoAdmin = () => {
    setEmail("admin@example.com")
    setPassword("AdminPass2026!")
    setErrorMsg(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsSubmitting(true)

    try {
      if (activeTab === "login") {
        await login({ email, password })
      } else {
        await register({
          email,
          password,
          target_exam: targetExam,
          target_level: targetLevel,
        })
      }
      navigate(from, { replace: true })
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de l'authentification.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold shadow-xs mx-auto text-lg">
            TEF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Portail de préparation TEF
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
            Accédez à votre espace d'apprentissage personnalisé et vos simulations officielles.
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/70 shadow-xs bg-card">
          <CardHeader className="pb-4">
            {/* Tab switchers */}
            <div className="grid grid-cols-2 rounded-lg bg-muted/40 p-1 border border-border/50">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login")
                  setErrorMsg(null)
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === "login"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("register")
                  setErrorMsg(null)
                }}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === "register"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Créer un compte
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {/* Error Banner */}
            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form id="auth-form" onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Adresse courriel</span>
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidat@exemple.com"
                  className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Mot de passe</span>
                </label>
                <input
                  type="password"
                  required
                  autoComplete={activeTab === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={activeTab === "register" ? "Minimum 12 caractères" : "••••••••••••"}
                  className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                />
                {activeTab === "register" && (
                  <p className="text-[11px] text-muted-foreground">
                    Le mot de passe doit comporter au moins 12 caractères.
                  </p>
                )}
              </div>

              {/* Registration Extra Fields */}
              {activeTab === "register" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Épreuve visée</label>
                    <select
                      value={targetExam}
                      onChange={(e) => setTargetExam(e.target.value)}
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="TEF Canada">TEF Canada</option>
                      <option value="TEF IRN">TEF IRN</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Niveau cible</label>
                    <select
                      value={targetLevel}
                      onChange={(e) => setTargetLevel(e.target.value)}
                      className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="B1">Niveau B1</option>
                      <option value="B2">Niveau B2</option>
                      <option value="C1">Niveau C1</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full cursor-pointer gap-2 font-medium mt-2 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span>Traitement en cours…</span>
                  </>
                ) : activeTab === "login" ? (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <span>Créer mon compte</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>

            {/* Quick Demo Pre-fills */}
            <div className="pt-3 border-t border-border/50 space-y-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Comptes de test (Environnement local)
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={fillDemoStudent}
                  className="px-2.5 py-1 rounded-md border border-border/60 bg-muted/30 hover:bg-muted/60 text-xs font-medium text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="size-3 text-primary" aria-hidden="true" />
                  <span>Étudiant Démo</span>
                </button>

                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  className="px-2.5 py-1 rounded-md border border-border/60 bg-muted/30 hover:bg-muted/60 text-xs font-medium text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="size-3 text-amber-500" aria-hidden="true" />
                  <span>Admin Démo</span>
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-0 justify-center text-xs text-muted-foreground border-t border-border/40 py-3">
            <Link to="/" className="hover:text-foreground hover:underline transition-colors">
              &larr; Retour à l'accueil
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
