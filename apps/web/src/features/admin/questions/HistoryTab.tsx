import React, { useState, useEffect } from "react";
import { History, Eye, ArrowLeftRight, Clock, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchQuestionVersions, getQuestionHistory } from "../api";
import type { QuestionItem, QuestionVersionItem, AuditEventItem } from "../types";

interface HistoryTabProps {
  question: Partial<QuestionItem>;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ question }) => {
  const [versions, setVersions] = useState<QuestionVersionItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<QuestionVersionItem | null>(null);
  const [diffVersion, setDiffVersion] = useState<QuestionVersionItem | null>(null);

  useEffect(() => {
    if (question.id) {
      loadHistory();
    }
  }, [question.id]);

  const loadHistory = async () => {
    if (!question.id) return;
    setLoading(true);
    try {
      const [verList, audList] = await Promise.all([
        fetchQuestionVersions(question.id),
        getQuestionHistory(question.id).catch(() => []),
      ]);
      setVersions(verList || []);
      setAuditEvents(audList || []);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Versions Section */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
            <History className="h-4 w-4 text-primary" />
            Instantanés immuables des versions ({versions.length})
          </div>
          <span className="text-2xs text-muted-foreground font-mono">
            Version active : v{question.version || 1} ({question.status || "draft"})
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Chargement de l'historique...
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
            Aucune version antérieure figée pour cette question.
            <br />
            Les instantanés immuables sont créés automatiquement lors de chaque publication officielle.
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="p-3 rounded-lg border border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-muted text-foreground border border-border">
                      v{ver.version_number}
                    </span>
                    <span className="font-semibold text-foreground">
                      {ver.changelog || "Snapshot de publication"}
                    </span>
                    {ver.status_at_version && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {ver.status_at_version}
                      </span>
                    )}
                  </div>
                  <div className="text-2xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {new Date(ver.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDiffVersion(ver)}
                    className="h-7 text-xs gap-1"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Comparer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedSnapshot(ver)}
                    className="h-7 text-xs gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> Inspecter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Event Timeline */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold text-xs border-b border-border pb-2">
          <Clock className="h-4 w-4 text-primary" />
          Journal d'audit des transitions du cycle de vie ({auditEvents.length})
        </div>

        {auditEvents.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            Aucun événement d'audit enregistré.
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {auditEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-lg border border-border/80 bg-background text-xs flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xs font-bold text-primary">
                      {evt.action}
                    </span>
                    {evt.actor_user_id && (
                      <span className="text-2xs text-muted-foreground font-mono">
                        par {evt.actor_user_id.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                  {evt.payload?.comments && (
                    <p className="text-2xs text-muted-foreground italic">
                      "{evt.payload.comments}"
                    </p>
                  )}
                </div>
                <span className="text-2xs text-muted-foreground font-mono shrink-0">
                  {new Date(evt.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot Inspect Modal */}
      {selectedSnapshot && (
        <Dialog open={!!selectedSnapshot} onOpenChange={() => setSelectedSnapshot(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <FileJson className="h-4 w-4 text-primary" />
                Instantané immuable v{selectedSnapshot.version_number}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-2 bg-muted/40 rounded-lg text-2xs font-mono">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(selectedSnapshot.snapshot_payload, null, 2)}
              </pre>
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setSelectedSnapshot(null)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Diff Modal */}
      {diffVersion && (
        <Dialog open={!!diffVersion} onOpenChange={() => setDiffVersion(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <ArrowLeftRight className="h-4 w-4 text-primary" />
                Comparaison : Version v{diffVersion.version_number} vs Version active v{question.version || 1}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
              <div className="grid grid-cols-2 gap-4 border-b border-border pb-3">
                <div>
                  <h4 className="font-bold text-muted-foreground mb-1">
                    v{diffVersion.version_number} (Instantané figé)
                  </h4>
                  <div className="p-2.5 rounded bg-muted/40 font-mono text-2xs space-y-1">
                    <div>
                      <strong>Énoncé :</strong> {diffVersion.snapshot_payload?.prompt}
                    </div>
                    <div>
                      <strong>Type :</strong> {diffVersion.snapshot_payload?.question_type}
                    </div>
                    <div>
                      <strong>CEFR :</strong> {diffVersion.snapshot_payload?.level || diffVersion.snapshot_payload?.target_cefr}
                    </div>
                    <div>
                      <strong>Difficulté :</strong> {diffVersion.snapshot_payload?.difficulty}/5
                    </div>
                    <div>
                      <strong>Options :</strong> {diffVersion.snapshot_payload?.options?.length || 0}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-primary mb-1">
                    v{question.version || 1} (Version active)
                  </h4>
                  <div className="p-2.5 rounded bg-primary/5 border border-primary/20 font-mono text-2xs space-y-1">
                    <div>
                      <strong>Énoncé :</strong> {question.prompt}
                    </div>
                    <div>
                      <strong>Type :</strong> {question.question_type}
                    </div>
                    <div>
                      <strong>CEFR :</strong> {question.target_cefr || question.level}
                    </div>
                    <div>
                      <strong>Difficulté :</strong> {question.item_difficulty ?? question.difficulty}/5
                    </div>
                    <div>
                      <strong>Options :</strong> {question.options?.length || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setDiffVersion(null)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
