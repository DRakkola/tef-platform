import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";

export interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  headerTitle?: string;
  headerActions?: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  headerTitle,
  headerActions,
}) => {
  return (
    <AppShell
      headerTitle={headerTitle}
      headerActions={headerActions}
      sidebarVariant="admin"
    >
      <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {children}
      </div>
    </AppShell>
  );
};
