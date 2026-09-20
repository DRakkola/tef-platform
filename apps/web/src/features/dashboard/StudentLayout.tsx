import React from "react"
import { AppShell } from "@/components/layout/AppShell"

export interface StudentLayoutProps {
  children: React.ReactNode
  headerTitle?: string
  headerActions?: React.ReactNode
}

export const StudentLayout: React.FC<StudentLayoutProps> = ({
  children,
  headerTitle,
  headerActions,
}) => {
  return (
    <AppShell headerTitle={headerTitle} headerActions={headerActions}>
      {children}
    </AppShell>
  )
}
