import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCw } from "lucide-react";
import { SettingsNav } from "./components/SettingsNav";
import { ProfileSection } from "./components/ProfileSection";
import { TefPreferencesSection } from "./components/TefPreferencesSection";
import { NotificationSection } from "./components/NotificationSection";
import { SecuritySection } from "./components/SecuritySection";
import { PrivacySection } from "./components/PrivacySection";
import { BillingSummarySection } from "./components/BillingSummarySection";
import { useSettingsData } from "./useSettings";
import { telemetry } from "@/features/analytics/telemetry";
import type { SettingsSection } from "./types";

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = (searchParams.get("tab") as SettingsSection) || "profile";
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  const {
    user,
    onboarding,
    billing,
    estimatedLevel,
    isLoading,
    isError,
    error,
    refetch,
  } = useSettingsData();

  useEffect(() => {
    telemetry.track("settings_viewed", { section: activeSection });
  }, [activeSection]);

  const handleSelectSection = (section: SettingsSection) => {
    setActiveSection(section);
    setSearchParams({ tab: section }, { replace: true });
  };

  return (
    <AppShell>
      <PageShell>
        <PageHeader
          title="Paramètres"
          description="Gérez votre profil, vos préférences et la sécurité de votre compte."
        />

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-full md:w-64 space-y-2">
              <Skeleton className="h-6 w-24 mb-4" />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
            <div className="flex-1 w-full space-y-4">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        )}

        {/* Global Error State */}
        {!isLoading && isError && (
          <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">
                  Impossible de charger vos paramètres
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(error as Error)?.message ||
                    "Une erreur est survenue lors de la récupération de vos informations."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-destructive/30 hover:bg-destructive/10"
            >
              <RotateCw className="size-3.5 mr-2" />
              Réessayer
            </Button>
          </div>
        )}

        {/* Content Layout */}
        {!isLoading && !isError && (
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Left Nav */}
            <SettingsNav
              activeSection={activeSection}
              onSelectSection={handleSelectSection}
            />

            {/* Right Active Section */}
            <main
              id="settings-content-region"
              className="flex-1 w-full min-w-0"
              role="region"
              aria-label={`Paramètres ${activeSection}`}
            >
              {activeSection === "profile" && (
                <ProfileSection user={user} onboarding={onboarding} />
              )}
              {activeSection === "tef" && (
                <TefPreferencesSection
                  onboarding={onboarding}
                  estimatedLevel={estimatedLevel}
                />
              )}
              {activeSection === "notifications" && (
                <NotificationSection onboarding={onboarding} />
              )}
              {activeSection === "security" && <SecuritySection user={user} />}
              {activeSection === "privacy" && <PrivacySection />}
              {activeSection === "billing" && (
                <BillingSummarySection billing={billing} />
              )}
            </main>
          </div>
        )}
      </PageShell>
    </AppShell>
  );
};
