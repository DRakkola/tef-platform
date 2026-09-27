import * as React from "react"
import { useLocation, Link } from "react-router-dom"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { NotificationCenter } from "@/features/dashboard/NotificationCenter"
import { ThemeSwitcher } from "@/components/common/ThemeSwitcher"

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/notifications": "Notifications",
  "/practice": "Pratique ciblée",
  "/progress": "Progression & NCLC",
  "/readiness": "Diagnostic d'admissibilité",
  "/teachers": "Professeurs certifiés",
  "/practice-pool": "Practice Pool oral",
  "/assessments": "Simulations TEF",
  "/writing": "Atelier d'écriture",
  "/billing": "Abonnement & Crédits",
  "/settings": "Paramètres",
  "/help": "Centre d'aide",
  "/onboarding": "Paramètres du profil",
  "/teacher": "Tableau de bord Enseignant",
  "/teacher/bookings": "Réservations de cours",
  "/teacher/corrections": "File de corrections",
  "/teacher/availability": "Gestion des disponibilités",
  "/teacher/earnings": "Revenus & Rémunération",
  "/admin": "Tableau de bord Admin",
  "/admin/beta": "Contrôle Bêta & Quotas",
  "/admin/ai-studio": "TEF AI Studio",
  "/admin/ai-sandbox": "TEF AI Studio",
  "/admin/analytics": "Product Analytics & Funnel",
  "/admin/health": "Santé Système & Services",
  "/admin/experiments": "Expérimentations A/B",
  "/admin/support": "Support & Triage",
  "/admin/billing": "Facturation & Revenus",
  "/admin/skills": "Taxonomie des Compétences",
  "/admin/assessments": "Simulations & Épreuves",
  "/admin/questions": "Banque de Questions",
  "/admin/exercises": "Exercices Drill",
  "/admin/writing-tasks": "Sujets d'écriture",
  "/admin/media": "Gestionnaire de Médias",
  "/admin/reviews": "File de Révision",
  "/admin/audit-logs": "Journal d'Audit",
  "/admin/design-system": "Système de Design",
}

export interface AppHeaderProps {
  title?: string
  children?: React.ReactNode
}

export function AppHeader({ title, children }: AppHeaderProps) {
  const location = useLocation()
  const currentLabel =
    title ||
    ROUTE_LABELS[location.pathname] ||
    Object.entries(ROUTE_LABELS).find(([path]) =>
      location.pathname.startsWith(path) && path !== "/"
    )?.[1] ||
    (location.pathname.startsWith("/admin") ? "Console Admin" : "Portail Candidat")

  const isAdminSubpage = location.pathname.startsWith("/admin") && location.pathname !== "/admin"
  const isTeacherSubpage = location.pathname.startsWith("/teacher") && location.pathname !== "/teacher"

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-card/80 px-4 sm:px-6 backdrop-blur-xs transition-[width,height] ease-linear">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger
          className="-ml-1 size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Ouvrir ou fermer le panneau latéral"
        />
        <Separator orientation="vertical" className=" h-4 my-auto bg-border" />
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground">
                <Link to="/dashboard">Accueil</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />

            {isAdminSubpage ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/admin">Administration</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground truncate max-w-[220px]">
                    {currentLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : isTeacherSubpage ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-muted-foreground hover:text-foreground">
                    <Link to="/teacher">Enseignant</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground truncate max-w-[220px]">
                    {currentLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium text-foreground truncate max-w-[220px]">
                  {currentLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <span className="sm:hidden font-medium text-sm text-foreground truncate">
          {currentLabel}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {children}
        <ThemeSwitcher size="sm" />
        <NotificationCenter />
      </div>
    </header>
  )
}
