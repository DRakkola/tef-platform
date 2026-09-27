import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "./AppSidebar"
import { AppHeader } from "./AppHeader"

export interface AppShellProps {
  children: React.ReactNode
  headerTitle?: string
  headerActions?: React.ReactNode
  studentName?: string
  studentEmail?: string
  targetLevel?: string
  targetExam?: string
  sidebarVariant?: "student" | "teacher" | "admin"
}

export function AppShell({
  children,
  headerTitle,
  headerActions,
  studentName,
  studentEmail,
  targetLevel,
  targetExam,
  sidebarVariant,
}: AppShellProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full bg-sidebar-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
          {/* Accessible keyboard skip link */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            Aller au contenu principal
          </a>

          {/* 1. Dark Charcoal Outer App Shell */}
          <AppSidebar
            studentName={studentName}
            studentEmail={studentEmail}
            targetLevel={targetLevel}
            targetExam={targetExam}
            variant={sidebarVariant}
          />

          {/* 2. Light Rounded Content Workspace Inset */}
          <SidebarInset className="bg-background flex flex-col overflow-hidden min-w-0 md:m-2.5 md:ml-0 md:rounded-2xl md:border md:border-border/60 md:shadow-xs min-h-screen md:min-h-[calc(100vh-1.25rem)]">
            <AppHeader title={headerTitle}>{headerActions}</AppHeader>
            <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-hidden">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

