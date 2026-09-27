import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Dumbbell,
  TrendingUp,
  GraduationCap,
  Users,
  FileCheck2,
  PenTool,
  LifeBuoy,
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  ChevronsUpDown,
  Calendar,
  Video,
  Clock,
  Bell,
  Mic,
  ShieldAlert,
  Sliders,
  Sparkles,
  Flame,
  Activity,
  BarChart3,
  FlaskConical,
  GitBranch,
  Image as ImageIcon,
  ExternalLink,
  ChevronRight,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth"

const primaryNavigation = [
  {
    title: "Tableau de bord",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Pratique",
    url: "/practice",
    icon: Dumbbell,
  },
  {
    title: "Expression Orale",
    url: "/speaking",
    icon: Mic,
  },
  {
    title: "Progression",
    url: "/progress",
    icon: TrendingUp,
  },
  {
    title: "Professeurs",
    url: "/teachers",
    icon: GraduationCap,
  },
  {
    title: "Practice Pool",
    url: "/practice-pool",
    icon: Users,
  },
]

const secondaryNavigation = [
  {
    title: "Simulations TEF",
    url: "/assessments",
    icon: FileCheck2,
  },
  {
    title: "Atelier d'écriture",
    url: "/writing",
    icon: PenTool,
  },
  {
    title: "Mes Séances",
    url: "/bookings",
    icon: Calendar,
  },
  {
    title: "Centre d'aide",
    url: "/help",
    icon: HelpCircle,
  },
]

const adminPilotNavigation = [
  {
    title: "Tableau de bord",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Contrôle Bêta & Quotas",
    url: "/admin/beta",
    icon: Flame,
  },
  {
    title: "TEF AI Studio",
    url: "/admin/ai-studio",
    icon: Sparkles,
    items: [
      {
        title: "Vue d'ensemble",
        url: "/admin/ai-studio",
      },
      {
        title: "Expression Écrite",
        url: "/admin/ai-studio/assessment/writing",
      },
      {
        title: "Expression Orale",
        url: "/admin/ai-studio/assessment/speaking",
      },
      {
        title: "Examinateur Live",
        url: "/admin/ai-studio/examiner",
      },
      {
        title: "Scénarios & Garde-fous",
        url: "/admin/ai-studio/scenarios",
      },
      {
        title: "Prompt Lab",
        url: "/admin/ai-studio/prompt-lab",
      },
      {
        title: "Runs & Comparateur",
        url: "/admin/ai-studio/runs",
      },
      {
        title: "Templates de Prompts",
        url: "/admin/ai-studio/templates",
      },
      {
        title: "Administration & Clés",
        url: "/admin/ai-studio/administration",
      },
    ],
  },
  {
    title: "Product Analytics",
    url: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Santé Système",
    url: "/admin/health",
    icon: Activity,
  },
  {
    title: "Expérimentations A/B",
    url: "/admin/experiments",
    icon: FlaskConical,
  },
  {
    title: "Support & Triage",
    url: "/admin/support",
    icon: LifeBuoy,
  },
]

const adminContentNavigation = [
  {
    title: "Taxonomie Compétences",
    url: "/admin/skills",
    icon: GitBranch,
  },
  {
    title: "Simulations & Épreuves",
    url: "/admin/assessments",
    icon: FileCheck2,
  },
  {
    title: "Banque de Questions",
    url: "/admin/questions",
    icon: HelpCircle,
  },
  {
    title: "Exercices Drill",
    url: "/admin/exercises",
    icon: Dumbbell,
  },
  {
    title: "Sujets d'écriture",
    url: "/admin/writing-tasks",
    icon: PenTool,
  },
  {
    title: "Médias & Audio",
    url: "/admin/media",
    icon: ImageIcon,
  },
]

const adminGovernanceNavigation = [
  {
    title: "File de Révision",
    url: "/admin/reviews",
    icon: Clock,
  },
  {
    title: "Journal d'Audit",
    url: "/admin/audit-logs",
    icon: ShieldAlert,
  },
  {
    title: "Système de Design",
    url: "/admin/design-system",
    icon: Sliders,
  },
]

const adminNavigation = [
  {
    title: "Tableau de bord Admin",
    url: "/admin",
    icon: ShieldAlert,
  },
  {
    title: "Gestion des épreuves",
    url: "/admin/assessments",
    icon: FileCheck2,
  },
  {
    title: "Contrôle Bêta",
    url: "/admin/beta",
    icon: Sliders,
  },
  {
    title: "TEF AI Studio",
    url: "/admin/ai-studio",
    icon: Sparkles,
  },
]

const teacherPrimaryNavigation = [
  {
    title: "Tableau de bord",
    url: "/teacher",
    icon: LayoutDashboard,
  },
  {
    title: "Réservations",
    url: "/teacher/bookings",
    icon: Calendar,
  },
  {
    title: "Corrections",
    url: "/teacher/corrections",
    icon: PenTool,
  },
  {
    title: "Séances",
    url: "/speaking",
    icon: Video,
  },
  {
    title: "Disponibilités",
    url: "/teacher/availability",
    icon: Clock,
  },
  {
    title: "Revenus",
    url: "/teacher/earnings",
    icon: CreditCard,
  },
]

const teacherSecondaryNavigation = [
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
  },
  {
    title: "Centre d'aide",
    url: "/help",
    icon: HelpCircle,
  },
]

export interface AppSidebarProps extends Omit<React.ComponentProps<typeof Sidebar>, "variant"> {
  studentName?: string
  studentEmail?: string
  targetLevel?: string
  targetExam?: string
  variant?: "student" | "teacher" | "admin"
  sidebarVariant?: "sidebar" | "floating" | "inset"
}

export function AppSidebar({
  studentName = "Candidat TEF",
  studentEmail = "candidat@tef-prep.ca",
  targetLevel = "B2 (NCLC 7)",
  targetExam: _targetExam = "TEF Canada",
  variant,
  sidebarVariant: _sidebarVariant,
  ...props
}: AppSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile, setOpenMobile } = useSidebar()
  const { user, logout } = useAuth()

  const effectiveName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email
        ? user.email.split("@")[0]
        : studentName

  const effectiveEmail = user?.email || studentEmail

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  const initials = effectiveName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const isAdminView =
    variant === "admin" || location.pathname.startsWith("/admin")
  const isTeacherView =
    !isAdminView &&
    (variant === "teacher" || user?.role === "teacher" || location.pathname.startsWith("/teacher"))

  const effectivePrimaryNav = isTeacherView ? teacherPrimaryNavigation : primaryNavigation
  const effectiveSecondaryNav = isTeacherView ? teacherSecondaryNavigation : secondaryNavigation

  return (
    <Sidebar
      collapsible="icon"
      className="bg-sidebar-background text-sidebar-foreground "
      {...props}
    >
      {/* 1. Header: Brand + Exam Target */}
      <SidebarHeader className=" p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-sidebar-muted/60 data-[state=open]:bg-sidebar-muted"
            >
              <Link to={isAdminView ? "/admin" : isTeacherView ? "/teacher" : "/dashboard"} className="flex items-center gap-3">
                <div className={`flex aspect-square size-8 items-center justify-center rounded-lg font-bold shadow-xs ${
                  isAdminView
                    ? "bg-teal text-teal-foreground"
                    : "bg-primary text-primary-foreground"
                }`}>
                  {isAdminView ? "ADM" : "TEF"}
                </div>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-semibold text-sidebar-foreground text-sm">
                    {isAdminView ? "Content Studio & Ops" : isTeacherView ? "Portail Enseignant" : "Portail TEF"}
                  </span>
                  <span className="truncate text-sidebar-foreground/70 font-mono">
                    {isAdminView ? "Console Admin" : isTeacherView ? "Espace Professeur" : `Cible\u00a0: ${targetLevel}`}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* 2. Main Navigation */}
      <SidebarContent className="px-2 py-3 gap-4">
        {isAdminView ? (
          <>
            {/* Admin Pilotage & IA */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1">
                Pilotage & IA
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminPilotNavigation.map((item) => {
                    const hasSubItems = Boolean((item as any).items && (item as any).items.length > 0)
                    const isActive =
                      item.url === "/admin"
                        ? location.pathname === "/admin"
                        : location.pathname.startsWith(item.url)

                    if (hasSubItems) {
                      const isAnySubActive = location.pathname.startsWith(item.url)
                      return (
                        <Collapsible
                          key={item.title}
                          asChild
                          defaultOpen={isAnySubActive}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                tooltip={item.title}
                                isActive={isAnySubActive}
                                className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground data-[active=true]:font-medium transition-colors"
                              >
                                <item.icon className="size-4 shrink-0 text-sidebar-foreground/70 group-data-[active=true]/menu-button:text-teal" />
                                <span>{item.title}</span>
                                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {(item as any).items.map((subItem: any) => {
                                  const isSubActive =
                                    subItem.url === "/admin/ai-studio"
                                      ? location.pathname === "/admin/ai-studio" || location.pathname === "/admin/ai-studio/"
                                      : location.pathname.startsWith(subItem.url)
                                  return (
                                    <SidebarMenuSubItem key={subItem.title}>
                                      <SidebarMenuSubButton asChild isActive={isSubActive}>
                                        <Link
                                          to={subItem.url}
                                          onClick={() => {
                                            if (isMobile) setOpenMobile(false)
                                          }}
                                        >
                                          <span>{subItem.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  )
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      )
                    }

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground data-[active=true]:font-medium transition-colors"
                          onClick={() => {
                            if (isMobile) setOpenMobile(false)
                          }}
                        >
                          <Link to={item.url}>
                            <item.icon className="size-4 shrink-0 text-sidebar-foreground/70 group-data-[active=true]/menu-button:text-teal" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin Content & Pedagogy */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1">
                Contenu & Pédagogie
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminContentNavigation.map((item) => {
                    const isActive = location.pathname.startsWith(item.url)
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground transition-colors"
                          onClick={() => {
                            if (isMobile) setOpenMobile(false)
                          }}
                        >
                          <Link to={item.url}>
                            <item.icon className="size-4 shrink-0 text-sidebar-foreground/60" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin Governance & System */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1">
                Gouvernance & Système
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminGovernanceNavigation.map((item) => {
                    const isActive = location.pathname.startsWith(item.url)
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground transition-colors"
                          onClick={() => {
                            if (isMobile) setOpenMobile(false)
                          }}
                        >
                          <Link to={item.url}>
                            <item.icon className="size-4 shrink-0 text-sidebar-foreground/60" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Switch Workspace */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1">
                Changer d'espace
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Vue Étudiant (Candidat)"
                      className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 transition-colors"
                    >
                      <Link to="/dashboard">
                        <ExternalLink className="size-4 shrink-0 text-sidebar-foreground/50" />
                        <span>Vue Étudiant</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Portail Enseignant"
                      className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 transition-colors"
                    >
                      <Link to="/teacher">
                        <GraduationCap className="size-4 shrink-0 text-sidebar-foreground/50" />
                        <span>Portail Enseignant</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            {/* Core Pillars */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1">
                {isTeacherView ? "Enseignement" : "Préparation"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {effectivePrimaryNav.map((item) => {
                    const isActive =
                      location.pathname === item.url ||
                      (item.url !== "/dashboard" &&
                        item.url !== "/teacher" &&
                        location.pathname.startsWith(item.url))
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground data-[active=true]:font-medium transition-colors"
                          onClick={() => {
                            if (isMobile) setOpenMobile(false)
                          }}
                        >
                          <Link to={item.url}>
                            <item.icon className="size-4 shrink-0 text-sidebar-foreground/70 group-data-[active=true]/menu-button:text-primary-foreground" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Secondary Modules */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1">
                {isTeacherView ? "Outils & Support" : "Épreuves & Outils"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {effectiveSecondaryNav.map((item) => {
                    const isActive = location.pathname.startsWith(item.url)
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground transition-colors"
                          onClick={() => {
                            if (isMobile) setOpenMobile(false)
                          }}
                        >
                          <Link to={item.url} >
                            <item.icon className="size-4 shrink-0 text-sidebar-foreground/60" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin Navigation (rendered for admin role) */}
            {user?.role === "admin" && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1 flex items-center justify-between">
                  <span>Administration</span>
                  <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">ADMIN</span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavigation.map((item) => {
                      const isActive = location.pathname.startsWith(item.url)
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.title}
                            className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 data-[active=true]:bg-sidebar-active data-[active=true]:text-sidebar-active-foreground transition-colors"
                            onClick={() => {
                              if (isMobile) setOpenMobile(false)
                            }}
                          >
                            <Link to={item.url}>
                              <item.icon className="size-4 shrink-0 text-sidebar-foreground/60" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      {/* 3. Footer: User Account / Menu */}
      <SidebarFooter className="border-t border-sidebar-border/80 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-muted text-sidebar-foreground hover:bg-sidebar-muted/60"
                  aria-label="Menu du compte utilisateur"
                >
                  <Avatar className="size-8 rounded-lg bg-sidebar-muted border border-sidebar-border text-sidebar-foreground">
                    <AvatarFallback className="rounded-lg text-xs font-bold bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-medium text-sidebar-foreground">
                      {effectiveName}
                    </span>
                    <span className="truncate text-sidebar-foreground/60">
                      {effectiveEmail}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-xl bg-card text-card-foreground border border-border shadow-lg p-1.5"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={6}
              >
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold leading-none text-foreground">
                      {effectiveName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {effectiveEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer text-xs"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="size-4 mr-2" />
                    <span>Paramètres du compte</span>
                  </DropdownMenuItem>

                  {isAdminView ? (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() => navigate("/admin")}
                      >
                        <ShieldAlert className="size-4 mr-2" />
                        <span>Tableau de bord Admin</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() => navigate("/dashboard")}
                      >
                        <ExternalLink className="size-4 mr-2" />
                        <span>Basculer vers Vue Candidat</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() => navigate("/admin/design-system")}
                      >
                        <Sliders className="size-4 mr-2" />
                        <span>Système de Design & Tokens</span>
                      </DropdownMenuItem>
                    </>
                  ) : isTeacherView ? (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() => navigate("/teacher/earnings")}
                      >
                        <CreditCard className="size-4 mr-2" />
                        <span>Mes revenus</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() => navigate("/teacher/availability")}
                      >
                        <Clock className="size-4 mr-2" />
                        <span>Mes disponibilités</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() => navigate("/billing")}
                      >
                        <CreditCard className="size-4 mr-2" />
                        <span>Abonnement & Facturation</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-xs"
                        onClick={() => navigate("/onboarding")}
                      >
                        <LifeBuoy className="size-4 mr-2" />
                        <span>Profil & Objectif NCLC</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuItem
                    className="cursor-pointer text-xs"
                    onClick={() => navigate("/help")}
                  >
                    <HelpCircle className="size-4 mr-2" />
                    <span>Centre d'aide & Support</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  className="cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4 mr-2" />
                  <span>Se déconnecter</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
