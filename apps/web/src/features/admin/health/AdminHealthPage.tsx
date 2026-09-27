import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Cpu,
  HardDrive,
  Bot,
  CreditCard,
  Radio,
  Clock,
} from "lucide-react";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { Button } from "@/components/ui/button";

interface HealthSubsystem {
  name: string;
  status: string;
  latency_ms: number | null;
  message: string | null;
  last_checked_at: string;
}

interface HealthData {
  overall_status: string;
  subsystems: HealthSubsystem[];
  server_timestamp: string;
}

export const AdminHealthPage: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/v1/admin/health", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch health probes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const getSubsystemIcon = (name: string) => {
    switch (name) {
      case "api_core":
        return Server;
      case "database_postgresql":
        return Database;
      case "redis_cache":
        return Cpu;
      case "storage_minio":
        return HardDrive;
      case "celery_workers":
        return Clock;
      case "ai_provider":
        return Bot;
      case "payment_gateway":
        return CreditCard;
      case "practice_pool_websockets":
        return Radio;
      default:
        return Server;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Opérationnel</span>
          </span>
        );
      case "degraded":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Dégradé</span>
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            <XCircle className="h-3.5 w-3.5" />
            <span>En Panne</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-mono">
            {status}
          </span>
        );
    }
  };

  return (
    <AdminLayout activeTab="health">
      <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
              <Activity className="h-4 w-4" />
              <span>Observabilité & Sondes Systèmes</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              État Opérationnel de l'Infrastructure
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Sondes en temps réel sur la base de données, Redis, stockage MinIO, Celery et passerelles IA/paiement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {health && (
              <div className="hidden sm:block text-right text-xs text-muted-foreground">
                <div>Dernier sondage :</div>
                <div className="font-mono text-foreground font-medium">
                  {new Date(health.server_timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealth}
              disabled={loading}
              className="border-border hover:bg-muted text-foreground text-xs flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Tester les sondes</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs p-4 rounded-xl flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Overall Status Banner */}
        {health && (
          <div
            className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              health.overall_status === "healthy"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                : health.overall_status === "degraded"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200"
                : "bg-red-500/10 border-red-500/20 text-red-800 dark:text-red-200"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                  health.overall_status === "healthy"
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : health.overall_status === "degraded"
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-red-500/20 text-red-600 dark:text-red-400"
                }`}
              >
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">
                  Statut Général : {health.overall_status.toUpperCase()}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {health.subsystems.filter((s) => s.status === "healthy").length} / {health.subsystems.length} sous-systèmes répondent normalement aux sondes actives.
                </div>
              </div>
            </div>

            <div>{getStatusBadge(health.overall_status)}</div>
          </div>
        )}

        {/* Subsystems Grid */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {health.subsystems.map((sub) => {
              const Icon = getSubsystemIcon(sub.name);
              return (
                <div
                  key={sub.name}
                  className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:border-primary/50 transition-colors shadow-2xs text-card-foreground"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted border border-border rounded-xl flex items-center justify-center text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground capitalize">
                          {sub.name.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {sub.latency_ms !== null ? `${sub.latency_ms} ms` : "--"}
                        </div>
                      </div>
                    </div>
                    <div>{getStatusBadge(sub.status)}</div>
                  </div>

                  <div className="bg-muted/40 p-3 rounded-xl border border-border/80 text-xs text-muted-foreground">
                    {sub.message || "Aucune anomalie détectée."}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
