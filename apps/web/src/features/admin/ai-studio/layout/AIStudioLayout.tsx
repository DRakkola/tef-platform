import React from "react";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { AIStudioHeader } from "./AIStudioHeader";

export interface AIStudioLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  headerActions?: React.ReactNode;
}

export const AIStudioLayout: React.FC<AIStudioLayoutProps> = ({
  children,
  title,
  description,
  headerActions,
}) => {
  return (
    <AdminLayout headerTitle="TEF AI Studio">
      <div className="space-y-6">
        <AIStudioHeader
          title={title}
          description={description}
          actions={headerActions}
        />
        {children}
      </div>
    </AdminLayout>
  );
};
