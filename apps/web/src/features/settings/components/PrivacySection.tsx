import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileJson,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useExportDataMutation, useDeleteAccountMutation } from "../useSettings";
import { useAuth } from "@/features/auth";
import { telemetry } from "@/features/analytics/telemetry";
import type { StudentDataExportResponse } from "../types";

export const PrivacySection: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const exportMutation = useExportDataMutation();
  const deleteMutation = useDeleteAccountMutation();

  const [exportData, setExportData] = useState<StudentDataExportResponse | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Deletion modal states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("prepa_terminee");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleRequestExport = async () => {
    setExportError(null);
    telemetry.track("data_export_requested");

    try {
      const data = await exportMutation.mutateAsync();
      setExportData(data);
    } catch (err: any) {
      setExportError(
        err?.message || "Impossible de générer l'archive de vos données pour le moment."
      );
    }
  };

  const handleDownloadExportJson = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tef-donnees-personnelles-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (!deletePassword) {
      setDeleteError("Veuillez saisir votre mot de passe pour confirmer la suppression.");
      return;
    }

    telemetry.track("account_deletion_requested", { reason: deleteReason });

    try {
      await deleteMutation.mutateAsync({
        password: deletePassword,
        reason: deleteReason,
      });

      setIsDeleteDialogOpen(false);
      await logout();
      navigate("/login?deleted=true");
    } catch (err: any) {
      const message =
        err?.status === 401 || err?.message?.toLowerCase().includes("password")
          ? "Mot de passe incorrect. Impossible de confirmer la suppression."
          : err?.message || "Une erreur est survenue lors de la suppression de votre compte.";
      setDeleteError(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Data Portability & Export */}
      <Card className="border border-border/80 shadow-xs bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Lock className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Confidentialité et données
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Consultez et téléchargez vos données conformément aux normes RGPD et LPRPDE.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">
                  Portabilité des données
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Téléchargez l'intégralité de votre historique : profil, simulations TEF, rédactions, sessions orales et activités d'apprentissage au format JSON standardisé.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRequestExport}
              disabled={exportMutation.isPending}
              className="shrink-0 w-full sm:w-auto"
            >
              <Download className="size-3.5 mr-1.5" />
              {exportMutation.isPending
                ? "Génération en cours..."
                : "Demander une copie de mes données"}
            </Button>
          </div>

          {exportError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {exportData && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Archive prête
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(exportData.exported_at).toLocaleString("fr-CA")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Votre archive contient {exportData.assessments_history?.length || 0} simulations,{" "}
                {exportData.writing_submissions?.length || 0} rédactions, et{" "}
                {exportData.speaking_sessions?.length || 0} sessions de pratique.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadExportJson}
                className="w-full sm:w-auto"
              >
                <FileJson className="size-4 mr-1.5" />
                Télécharger le fichier JSON
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Danger Zone — Account Deletion */}
      <Card className="border border-destructive/30 shadow-xs bg-destructive/5 dark:bg-destructive/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-destructive">
                Zone sensible
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Suppression irréversible de votre compte et de vos données d'apprentissage.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-background border border-destructive/20">
            <div className="space-y-1">
              <span className="font-semibold text-sm text-foreground">
                Supprimer définitivement mon compte
              </span>
              <p className="text-xs text-muted-foreground">
                Cette action anonymise immédiatement vos données personnelles, annule vos réservations en cours et révoque vos accès à la plateforme.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="shrink-0 w-full sm:w-auto"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Supprimer mon compte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deletion Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive pb-1">
              <AlertTriangle className="size-5" />
              <DialogTitle className="text-base font-semibold">
                Confirmer la suppression du compte
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Êtes-vous absolument certain de vouloir supprimer votre compte ? Cette action est définitive et irréversible.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDeleteAccount} className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/60 border border-border/80 text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">Conséquences de la suppression :</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Vos résultats d'examens et simulations seront anonymisés.</li>
                <li>Toutes vos sessions de cours à venir seront annulées.</li>
                <li>Vos crédits restants et abonnements actifs seront révoqués.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="delete-reason"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                Raison de votre départ (optionnel)
              </label>
              <select
                id="delete-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-xs"
              >
                <option value="prepa_terminee">J'ai terminé mon examen TEF</option>
                <option value="objectif_atteint">J'ai atteint mon score visé</option>
                <option value="autre_plateforme">J'utilise une autre solution</option>
                <option value="pause">Je fais une pause dans mes révisions</option>
                <option value="autre">Autre motif</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="delete-password-confirm"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground"
              >
                Saisissez votre mot de passe pour confirmer
              </label>
              <Input
                id="delete-password-confirm"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Votre mot de passe actuel"
                className="h-9"
                required
              />
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                <AlertCircle className="size-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeletePassword("");
                  setDeleteError(null);
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={!deletePassword || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Suppression en cours..." : "Confirmer la suppression"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
