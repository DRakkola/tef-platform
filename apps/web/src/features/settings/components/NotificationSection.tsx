import React, { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  Smartphone,
  BookOpen,
  GraduationCap,
  Users,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdateNotificationPreferencesMutation } from "../useSettings";
import { telemetry } from "@/features/analytics/telemetry";
import type { NotificationSettingsState } from "../types";
import type { OnboardingStateApi } from "../api";

interface NotificationSectionProps {
  onboarding?: OnboardingStateApi;
}

const DEFAULT_NOTIFICATIONS: NotificationSettingsState = {
  learning: { email: true, in_app: true },
  teacher: { email: true, in_app: true },
  practice: { email: true, in_app: true },
  billing: { email: true, in_app: true },
  system: { email: true, in_app: true }, // Mandatory
};

export const NotificationSection: React.FC<NotificationSectionProps> = ({ onboarding }) => {
  const updatePrefs = useUpdateNotificationPreferencesMutation();

  const initialPreferences: NotificationSettingsState =
    onboarding?.learning_preferences?.notification_preferences || DEFAULT_NOTIFICATIONS;

  const [preferences, setPreferences] = useState<NotificationSettingsState>(initialPreferences);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (onboarding?.learning_preferences?.notification_preferences) {
      setPreferences({
        ...DEFAULT_NOTIFICATIONS,
        ...onboarding.learning_preferences.notification_preferences,
        system: { email: true, in_app: true }, // enforce mandatory
      });
    }
  }, [onboarding]);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);

  const toggleChannel = (
    category: keyof NotificationSettingsState,
    channel: "email" | "in_app"
  ) => {
    if (category === "system") return; // cannot modify mandatory system alerts

    setPreferences((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: !prev[category][channel],
      },
    }));
  };

  const handleReset = () => {
    setPreferences(initialPreferences);
    setErrorMessage(null);
    setIsSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSuccess(false);

    try {
      await updatePrefs.mutateAsync(preferences);
      setIsSuccess(true);
      telemetry.track("notification_preferences_updated", {
        learningEmail: preferences.learning.email,
        teacherEmail: preferences.teacher.email,
        practiceEmail: preferences.practice.email,
        billingEmail: preferences.billing.email,
      });
      setTimeout(() => setIsSuccess(false), 4000);
    } catch (err: any) {
      const message =
        err?.message ||
        "Impossible d'enregistrer vos préférences de notification. Réessayez plus tard.";
      setErrorMessage(message);
    }
  };

  const categories = [
    {
      id: "learning" as const,
      title: "Apprentissage & Résultats",
      description: "Résultats de simulations, corrections de rédaction et recommandations.",
      icon: BookOpen,
      isMandatory: false,
    },
    {
      id: "teacher" as const,
      title: "Professeurs & Cours",
      description: "Confirmations, rappels de cours et retours personnalisés de professeurs.",
      icon: GraduationCap,
      isMandatory: false,
    },
    {
      id: "practice" as const,
      title: "Practice Pool",
      description: "Demandes de pratique orale reçues, acceptations et rappels de session.",
      icon: Users,
      isMandatory: false,
    },
    {
      id: "billing" as const,
      title: "Facturation & Crédits",
      description: "Reçus de paiement, renouvellements d'abonnement et alertes de crédits faibles.",
      icon: CreditCard,
      isMandatory: false,
    },
    {
      id: "system" as const,
      title: "Sécurité & Système",
      description: "Alertes de sécurité, modifications de compte et annonces critiques.",
      icon: ShieldAlert,
      isMandatory: true,
    },
  ];

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Bell className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Notifications</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Choisissez les notifications que vous souhaitez recevoir par courriel et dans l'application.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="space-y-6">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 pb-2 border-b border-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-8">Catégorie d'alerte</div>
            <div className="col-span-2 text-center flex items-center justify-center gap-1">
              <Mail className="size-3.5" />
              <span>Courriel</span>
            </div>
            <div className="col-span-2 text-center flex items-center justify-center gap-1">
              <Smartphone className="size-3.5" />
              <span>Dans l'app</span>
            </div>
          </div>

          {/* Categories List */}
          <div className="divide-y divide-border/60">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const catPrefs = preferences[cat.id];

              return (
                <div
                  key={cat.id}
                  className="py-4 flex flex-col sm:grid sm:grid-cols-12 gap-3 items-start sm:items-center"
                >
                  {/* Category Info */}
                  <div className="sm:col-span-8 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted/60 border border-border/60 text-foreground shrink-0 mt-0.5 sm:mt-0">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{cat.title}</span>
                        {cat.isMandatory && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                            <Lock className="size-2.5 mr-1" />
                            Obligatoire
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    </div>
                  </div>

                  {/* Channel Controls */}
                  <div className="w-full sm:w-auto sm:col-span-4 flex items-center justify-between sm:justify-around gap-4 pt-2 sm:pt-0 pl-11 sm:pl-0">
                    {/* Email Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="sm:hidden text-xs font-medium text-muted-foreground">Courriel :</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={catPrefs.email}
                        aria-label={`Notification courriel pour ${cat.title}`}
                        disabled={cat.isMandatory}
                        onClick={() => toggleChannel(cat.id, "email")}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                          catPrefs.email ? "bg-primary" : "bg-muted"
                        } ${cat.isMandatory ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                            catPrefs.email ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* In-App Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="sm:hidden text-xs font-medium text-muted-foreground">Dans l'app :</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={catPrefs.in_app}
                        aria-label={`Notification dans l'application pour ${cat.title}`}
                        disabled={cat.isMandatory}
                        onClick={() => toggleChannel(cat.id, "in_app")}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                          catPrefs.in_app ? "bg-primary" : "bg-muted"
                        } ${cat.isMandatory ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                            catPrefs.in_app ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm border border-emerald-500/20">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Vos préférences de notification ont été mises à jour avec succès.</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-4">
          <span className="text-xs text-muted-foreground order-2 sm:order-1">
            {isDirty ? "Modifications non enregistrées" : "Préférences à jour"}
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || updatePrefs.isPending}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isDirty || updatePrefs.isPending}
              className="w-full sm:w-auto"
            >
              {updatePrefs.isPending ? "Enregistrement..." : "Enregistrer les préférences"}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};
