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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
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
    title: "Aide & Guide",
    url: "/onboarding",
    icon: LifeBuoy,
  },
]

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  studentName?: string
  studentEmail?: string
  targetLevel?: string
  targetExam?: string
}

export function AppSidebar({
  studentName = "Candidat TEF",
  studentEmail = "candidat@tef-prep.ca",
  targetLevel = "B2 (NCLC 7)",
  targetExam = "TEF Canada",
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
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-xs">
                  TEF
                </div>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-semibold text-sidebar-foreground text-sm">
                    Portail TEF
                  </span>
                  <span className="truncate text-sidebar-foreground/70 font-mono">
                    Cible&nbsp;: {targetLevel}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* 2. Main Student Navigation */}
      <SidebarContent className="px-2 py-3 gap-4">
        {/* Core Pillars */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-medium tracking-wider uppercase text-sidebar-foreground/50 px-2 mb-1">
            Préparation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNavigation.map((item) => {
                const isActive =
                  location.pathname === item.url ||
                  (item.url !== "/dashboard" &&
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
            Épreuves & Outils
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavigation.map((item) => {
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
