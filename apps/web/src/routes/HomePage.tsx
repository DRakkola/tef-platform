/**
 * TEF Platform Foundation Landing / Status Page.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/core/api";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Database, Server, HardDrive, Cpu, RefreshCw } from "lucide-react";

interface SystemStatus {
  platform: string;
  version: string;
  environment: string;
  baselines: {
    python: string;
    postgres: string;
    redis: string;
    storage: string;
  };
}

export const HomePage: React.FC = () => {
  const {
    data: statusData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["system-status"],
    queryFn: () => apiClient<SystemStatus>("/status"),
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Foundation Active
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">TEF Preparation Platform</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Production-grade modular monolith architecture adhering to the engineering contract.
          </p>
          <div className="pt-2">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              Accéder au Tableau de bord Étudiant &rarr;
            </a>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-card text-card-foreground border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">System Foundation Status</h2>
                <p className="text-xs text-muted-foreground">Real-time health verification</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <LoadingState message="Connecting to TEF API..." />
          ) : isError ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">API Disconnected:</span> Backend server is not
                responding or initializing.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Cpu className="w-4 h-4" />
                  Backend
                </div>
                <div className="text-lg font-bold">Python {statusData?.baselines.python}</div>
                <div className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> FastAPI
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Database className="w-4 h-4" />
                  Database
                </div>
                <div className="text-lg font-bold">PostgreSQL {statusData?.baselines.postgres}</div>
                <div className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> System of Record
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Server className="w-4 h-4" />
                  Cache / Queue
                </div>
                <div className="text-lg font-bold">Redis {statusData?.baselines.redis}</div>
                <div className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Celery Broker
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <HardDrive className="w-4 h-4" />
                  Object Storage
                </div>
                <div className="text-lg font-bold">MinIO</div>
                <div className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Private S3
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Node 24 LTS &bull; Vite &bull; Tailwind CSS &bull; shadcn/ui &bull; TanStack Query
        </div>
      </div>
    </div>
  );
};
