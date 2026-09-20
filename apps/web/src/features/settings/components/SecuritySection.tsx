import React, { useState } from "react";
import {
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  MailCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useChangePasswordMutation } from "../useSettings";
import { telemetry } from "@/features/analytics/telemetry";
import type { UserMeApi } from "../api";

interface SecuritySectionProps {
  user?: UserMeApi;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({ user }) => {
  const changePasswordMutation = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation rules
  const hasMinLength = newPassword.length >= 12;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && hasMinLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSuccess(false);

    if (!hasMinLength) {
      setErrorMessage("Le nouveau mot de passe doit comporter au moins 12 caractères.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    telemetry.track("password_change_started");

    try {
      await changePasswordMutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setIsSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      telemetry.track("password_changed");
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err: any) {
      const status = err?.status;
      let message = "Impossible de modifier votre mot de passe. Veuillez réessayer.";

      if (status === 401 || err?.message?.toLowerCase().includes("current password")) {
        message = "Le mot de passe actuel renseigné est incorrect.";
      } else if (err?.message) {
        message = err.message;
      }

      setErrorMessage(message);
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs bg-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Sécurité</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Gérez votre mot de passe et protégez l'accès à votre compte.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Email Verification Banner */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background border border-border/80 text-foreground">
              <MailCheck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">État de vérification</span>
                {user?.is_verified ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    <CheckCircle2 className="size-3 mr-1" />
                    Courriel vérifié
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                    En attente de vérification
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Change Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="flex items-center gap-2 pb-1 border-b border-border/60">
            <KeyRound className="size-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Modifier le mot de passe
            </h3>
          </div>

          {/* Current Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="security-current-password"
              className="block text-xs font-semibold uppercase tracking-wider text-foreground"
            >
              Mot de passe actuel
            </label>
            <div className="relative">
              <Input
                id="security-current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Votre mot de passe actuel"
                className="h-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label={showCurrent ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="security-new-password"
              className="block text-xs font-semibold uppercase tracking-wider text-foreground"
            >
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Input
                id="security-new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Au moins 12 caractères"
                className="h-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label={showNew ? "Masquer le nouveau mot de passe" : "Afficher le nouveau mot de passe"}
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="security-confirm-password"
              className="block text-xs font-semibold uppercase tracking-wider text-foreground"
            >
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <Input
                id="security-confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmez votre nouveau mot de passe"
                className="h-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label={showConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Password Requirements Checklist */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider block">
              Exigences de sécurité :
            </span>
            <div className="flex items-center gap-2">
              {hasMinLength ? (
                <Check className="size-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="size-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={hasMinLength ? "text-foreground font-medium" : ""}>
                Au moins 12 caractères
              </span>
            </div>
            <div className="flex items-center gap-2">
              {passwordsMatch ? (
                <Check className="size-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="size-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={passwordsMatch ? "text-foreground font-medium" : ""}>
                Les mots de passe correspondent
              </span>
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
              <span>Mot de passe modifié avec succès. Vos sessions précédentes ont été invalidées.</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || changePasswordMutation.isPending}
              className="w-full sm:w-auto"
            >
              {changePasswordMutation.isPending ? "Modification en cours..." : "Modifier le mot de passe"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
