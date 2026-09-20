import React, { useState, useEffect } from "react";
import { User, CheckCircle2, AlertCircle, Clock, Globe } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUpdateProfileMutation } from "../useSettings";
import { telemetry } from "@/features/analytics/telemetry";
import type { UserMeApi, OnboardingStateApi } from "../api";

interface ProfileSectionProps {
  user?: UserMeApi;
  onboarding?: OnboardingStateApi;
}

const COMMON_TIMEZONES = [
  { value: "America/Toronto", label: "Amérique / Toronto (UTC-5/UTC-4)" },
  { value: "America/Montreal", label: "Amérique / Montréal (UTC-5/UTC-4)" },
  { value: "America/Vancouver", label: "Amérique / Vancouver (UTC-8/UTC-7)" },
  { value: "Europe/Paris", label: "Europe / Paris (UTC+1/UTC+2)" },
  { value: "Africa/Casablanca", label: "Afrique / Casablanca (UTC+1)" },
  { value: "Africa/Dakar", label: "Afrique / Dakar (UTC+0)" },
  { value: "Asia/Dubai", label: "Asie / Dubaï (UTC+4)" },
  { value: "UTC", label: "Temps Universel Coordonné (UTC)" },
];

const SUPPORTED_LANGUAGES = [
  { value: "fr-CA", label: "Français (Canada)" },
  { value: "fr-FR", label: "Français (France)" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];

export const ProfileSection: React.FC<ProfileSectionProps> = ({ user, onboarding }) => {
  const updateProfile = useUpdateProfileMutation();

  const initialDisplayName =
    onboarding?.learning_preferences?.display_name ||
    user?.email?.split("@")[0] ||
    "Candidat TEF";
  const initialTimezone = onboarding?.timezone || user?.student_profile?.timezone || "America/Toronto";
  const initialLanguage = onboarding?.native_language || "fr-CA";

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [language, setLanguage] = useState(initialLanguage);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync when data loads
  useEffect(() => {
    if (onboarding?.learning_preferences?.display_name) {
      setDisplayName(onboarding.learning_preferences.display_name);
    }
    if (onboarding?.timezone) {
      setTimezone(onboarding.timezone);
    }
    if (onboarding?.native_language) {
      setLanguage(onboarding.native_language);
    }
  }, [onboarding]);

  const isDirty =
    displayName !== initialDisplayName ||
    timezone !== initialTimezone ||
    language !== initialLanguage;

  const handleReset = () => {
    setDisplayName(initialDisplayName);
    setTimezone(initialTimezone);
    setLanguage(initialLanguage);
    setErrorMessage(null);
    setIsSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSuccess(false);

    if (!displayName.trim()) {
      setErrorMessage("Veuillez saisir votre prénom ou nom d'affichage.");
      return;
    }

    try {
      await updateProfile.mutateAsync({
        displayName: displayName.trim(),
        timezone,
        language,
      });
      setIsSuccess(true);
      telemetry.track("profile_updated", { timezone, language });
      setTimeout(() => setIsSuccess(false), 4000);
    } catch (err: any) {
      const message =
        err?.message ||
        "Impossible d'enregistrer vos modifications. Vérifiez votre connexion et réessayez.";
      setErrorMessage(message);
    }
  };

  // Avatar initials
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n: string) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "TE";

  // Current local time preview in selected timezone
  const getTimePreview = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("fr-CA", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date());
    } catch {
      return "";
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Profil</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Vos informations personnelles utilisées dans votre compte.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="space-y-6">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border/60">
            <Avatar className="size-16 rounded-full border-2 border-border shadow-xs">
              <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">{displayName}</span>
                <Badge variant="secondary" className="text-[10px] font-medium uppercase">
                  {user?.role === "student" ? "Candidat" : user?.role || "Étudiant"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Avatar généré à partir de votre nom d'affichage.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Display Name */}
            <div className="space-y-2">
              <label
                htmlFor="profile-display-name"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                Prénom & Nom d'affichage
              </label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex. Jean Tremblay"
                className="h-10"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Ce nom sera visible par vos professeurs et vos partenaires de pratique.
              </p>
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-foreground"
                >
                  Adresse courriel
                </label>
                {user?.is_verified ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    <CheckCircle2 className="size-3 mr-1" />
                    Vérifié
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                    En attente
                  </Badge>
                )}
              </div>
              <Input
                id="profile-email"
                value={user?.email || ""}
                readOnly
                disabled
                className="h-10 bg-muted/50 cursor-not-allowed text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                La modification de l'adresse courriel nécessite une vérification de sécurité.
              </p>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-timezone"
                  className="block text-xs font-semibold uppercase tracking-wider text-foreground"
                >
                  Fuseau horaire
                </label>
                {timezone && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    {getTimePreview(timezone)}
                  </span>
                )}
              </div>
              <select
                id="profile-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Utilisé pour calculer vos créneaux de cours et vos rappels de session.
              </p>
            </div>

            {/* Language / Locale */}
            <div className="space-y-2">
              <label
                htmlFor="profile-language"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5"
              >
                <Globe className="size-3.5" />
                Langue de l'interface
              </label>
              <select
                id="profile-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Langue principale utilisée pour vos notifications et consignes d'exercices.
              </p>
            </div>
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
              <span>Vos informations de profil ont été enregistrées avec succès.</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-4">
          <span className="text-xs text-muted-foreground order-2 sm:order-1">
            {isDirty ? "Modifications non enregistrées" : "Profil à jour"}
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || updateProfile.isPending}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isDirty || updateProfile.isPending}
              className="w-full sm:w-auto"
            >
              {updateProfile.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};
