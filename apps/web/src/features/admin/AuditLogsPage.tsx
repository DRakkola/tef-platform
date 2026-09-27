import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Eye,
  Code2,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { fetchAuditLogs } from "./api";
import type { AuditEventItem } from "./types";
import { Button } from "@/components/ui/button";

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [selectedPayload, setSelectedPayload] = useState<Record<string, any> | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAuditLogs({
        entity_type: entityFilter || undefined,
        action: actionFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityFilter, actionFilter]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" />
              Administrative Audit Logs ({total})
            </h1>
            <p className="text-sm text-muted-foreground">
              Immutable ledger tracking all content modifications, validations, approvals, and publish events.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-card border border-border p-3 rounded-xl text-xs">
          <span className="text-muted-foreground font-medium">Filter by:</span>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Entity Types</option>
            <option value="assessment">Assessments</option>
            <option value="section">Sections</option>
            <option value="question">Questions</option>
            <option value="exercise">Exercises</option>
            <option value="writing_task">Writing Tasks</option>
            <option value="media_asset">Media Assets</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-background border border-border text-foreground rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary"
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="PUBLISH">PUBLISH</option>
            <option value="ARCHIVE">ARCHIVE</option>
            <option value="DELETE">DELETE</option>
            <option value="content.publish">content.publish</option>
            <option value="content.fork_version">content.fork_version</option>
            <option value="review.decision">review.decision</option>
          </select>
        </div>

        {/* Logs Table */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-card text-muted-foreground text-sm">
            No audit events found matching the criteria.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-mono border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Entity ID</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground">
                  {logs.map((event) => (
                    <tr key={event.id} className="hover:bg-muted/40 transition font-mono">
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                        {new Date(event.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded uppercase font-bold text-2xs ${
                            event.action.includes("CREATE")
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                              : event.action.includes("PUBLISH") || event.action.includes("publish")
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : event.action.includes("DELETE")
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {event.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-foreground">
                        {event.entity_type}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {event.entity_id ? `${event.entity_id.slice(0, 8)}...` : "—"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {event.actor_user_id ? `${event.actor_user_id.slice(0, 8)}...` : "system"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPayload(event.payload)}
                          className="h-6 text-2xs border-border text-foreground hover:bg-muted gap-1 px-2"
                        >
                          <Eye className="h-3 w-3" /> Payload
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: View Payload */}
        {selectedPayload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl text-card-foreground">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  Audit Event Payload Snapshot
                </h2>
                <button
                  onClick={() => setSelectedPayload(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <pre className="p-4 rounded-lg bg-muted/50 border border-border/80 text-xs text-foreground font-mono max-h-96 overflow-auto">
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPayload(null)}
                  className="border-border text-foreground hover:bg-muted text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
