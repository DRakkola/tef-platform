import React, { useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bulkParseQuestionFile,
  aiAutoTagAndFormatQuestions,
  commitBulkQuestionImport,
  downloadImportTemplateCsv,
} from "../api";
import type { BulkImportQuestionItem } from "../types";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "success">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [parsedItems, setParsedItems] = useState<BulkImportQuestionItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [targetStatus, setTargetStatus] = useState("draft");
  const [committedCount, setCommittedCount] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    setGlobalError(null);
    setParseErrors([]);
    try {
      const res = await bulkParseQuestionFile(file);
      setParsedItems(res.items || []);
      setParseErrors(res.parse_errors || []);
      if (res.items && res.items.length > 0) {
        setStep("preview");
      } else {
        setGlobalError("Aucune question valide n'a pu être extraite de ce fichier.");
      }
    } catch (err: any) {
      setGlobalError(err.message || "Erreur lors de la lecture du fichier.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleRunAiEnrichment = async () => {
    if (parsedItems.length === 0) return;
    setIsEnriching(true);
    setGlobalError(null);
    try {
      const res = await aiAutoTagAndFormatQuestions(parsedItems, true, true);
      setParsedItems(res.items);
    } catch (err: any) {
      setGlobalError(err.message || "Échec de l'enrichissement par IA.");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleCommit = async () => {
    const validItems = parsedItems.filter((item) => item.is_valid);
    if (validItems.length === 0) {
      setGlobalError("Aucune question valide prête pour l'import.");
      return;
    }
    setIsCommitting(true);
    setGlobalError(null);
    try {
      const res = await commitBulkQuestionImport(validItems, targetStatus);
      setCommittedCount(res.created_count);
      setStep("success");
      onSuccess(res.created_count);
    } catch (err: any) {
      setGlobalError(err.message || "Échec de l'importation en base de données.");
    } finally {
      setIsCommitting(false);
    }
  };

  const downloadJsonTemplate = () => {
    const sample = [
      {
        prompt: "Quel est l'objectif principal de ce message ?",
        question_type: "single_choice",
        modality: "reading",
        level: "B1",
        difficulty: 2,
        options: [
          { content: "Informer d'un retard", is_correct: true },
          { content: "Annuler une réunion", is_correct: false },
          { content: "Féliciter un collègue", is_correct: false }
        ],
        stimulus_title: "Note de service",
        stimulus_text: "En raison d'un problème technique, le train aura 20 minutes de retard."
      }
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tef_question_import_sample.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedItems.filter((i) => i.is_valid).length;
  const invalidCount = parsedItems.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importation de questions en masse
            </h2>
            <p className="text-xs text-muted-foreground">
              Intégrez rapidement vos séries d'items via CSV, Excel ou JSON avec auto-tagging et formatage IA.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {globalError && (
          <div className="p-3 mx-4 mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary rounded-2xl p-8 text-center cursor-pointer transition bg-card/60 hover:bg-primary/5 flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                  disabled={isParsing}
                />
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span>Analyse du fichier et validation des schémas...</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 rounded-full bg-primary/10 text-primary">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Glissez-déposez votre fichier ici, ou <span className="text-primary underline">parcourir</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Formats pris en charge : <strong>CSV</strong>, <strong>Excel (.xlsx)</strong>, <strong>JSON</strong>
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Download templates */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Besoin d'un modèle d'import prêt à l'emploi ?
                  </div>
                  <div className="text-2xs text-muted-foreground">
                    Téléchargez nos gabarits d'exemple avec les colonnes attendues (énoncé, réponses, document, compétences).
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadImportTemplateCsv}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Download className="h-3.5 w-3.5" /> Modèle CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadJsonTemplate}
                    className="text-xs gap-1.5 h-8"
                  >
                    <Download className="h-3.5 w-3.5" /> Modèle JSON
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {/* Stats & AI Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-foreground">
                    {parsedItems.length} question{parsedItems.length > 1 ? "s" : ""} détectée{parsedItems.length > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 text-2xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> {validCount} valide{validCount > 1 ? "s" : ""}
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 text-rose-600 text-2xs font-bold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      <XCircle className="h-3 w-3" /> {invalidCount} invalide{invalidCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunAiEnrichment}
                    disabled={isEnriching || isCommitting}
                    className="gap-1.5 text-xs text-purple-600 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 font-semibold"
                  >
                    {isEnriching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Auto-tagger & Formater par IA
                  </Button>
                </div>
              </div>

              {parseErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avertissements de lecture :
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-2xs">
                    {parseErrors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 3 && (
                      <li>... et {parseErrors.length - 3} autres remarques.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="rounded-xl border border-border overflow-hidden bg-card text-xs">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/50 border-b border-border text-2xs text-muted-foreground uppercase sticky top-0">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Énoncé</th>
                        <th className="p-2.5">Modalité</th>
                        <th className="p-2.5">Niveau</th>
                        <th className="p-2.5">Diff.</th>
                        <th className="p-2.5">Document support</th>
                        <th className="p-2.5">Options</th>
                        <th className="p-2.5">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {parsedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition">
                          <td className="p-2.5 text-2xs font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 font-medium text-foreground max-w-xs truncate" title={item.prompt}>
                            {item.prompt || <span className="text-rose-500 italic">Énoncé manquant</span>}
                          </td>
                          <td className="p-2.5 capitalize text-2xs text-muted-foreground">
                            {item.modality}
                          </td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-2xs">
                              {item.target_cefr || item.level}
                            </span>
                          </td>
                          <td className="p-2.5 text-2xs text-muted-foreground">
                            {item.difficulty}/5
                          </td>
                          <td className="p-2.5 text-2xs text-muted-foreground max-w-[120px] truncate" title={item.stimulus_title || item.stimulus_text || ""}>
                            {item.stimulus_title || (item.stimulus_text ? "Document inclus" : "—")}
                          </td>
                          <td className="p-2.5 text-2xs">
                            <span className="font-mono">{item.options.length}</span> choix
                          </td>
                          <td className="p-2.5">
                            {item.is_valid ? (
                              <span className="flex items-center gap-1 text-2xs font-semibold text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> Valide
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-2xs font-semibold text-rose-600" title={item.validation_errors?.join(", ")}>
                                <XCircle className="h-3 w-3" /> Erreurs
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status target selector */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-xs">
                <span className="font-semibold text-foreground">
                  Statut initial des questions créées :
                </span>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="rounded-md border border-border bg-background p-1.5 text-xs text-foreground font-semibold"
                >
                  <option value="draft">Brouillon (Recommandé pour relecture)</option>
                  <option value="in_review">En révision éditoriale</option>
                  <option value="approved">Approuvé</option>
                  <option value="published">Publié immédiatement</option>
                </select>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Importation terminée avec succès !
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  <strong>{committedCount}</strong> question{committedCount > 1 ? "s ont" : " a"} été créée{committedCount > 1 ? "s" : ""} dans la banque avec le statut « {targetStatus} ».
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          {step === "upload" && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("upload")}
                disabled={isCommitting}
              >
                Retour
              </Button>
              <Button
                size="sm"
                onClick={handleCommit}
                disabled={isCommitting || validCount === 0}
                className="gap-1.5 font-semibold"
              >
                {isCommitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Confirmer l'import ({validCount} question{validCount > 1 ? "s" : ""})
              </Button>
            </>
          )}

          {step === "success" && (
            <div className="w-full flex justify-end">
              <Button size="sm" onClick={onClose} className="font-semibold">
                Fermer et voir les questions
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
