/**
 * OfflineBanner: Sticky status indicator for offline state and reconnection.
 * Informs the learner smoothly without disrupting active workflows.
 */

import React, { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? !navigator.onLine : false;
  });
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
      >
        <Wifi className="size-4 animate-bounce" aria-hidden="true" />
        <span>Connexion rétablie. Vos données se synchronisent.</span>
      </div>
    );
  }

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          Vous êtes actuellement hors connexion. Certaines fonctionnalités interactives sont suspendues.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.location.reload()}
        className="h-6 px-2 text-xs text-amber-950 bg-amber-100 hover:bg-white border-none shrink-0 cursor-pointer"
      >
        <RefreshCw className="size-3 mr-1" />
        Actualiser
      </Button>
    </div>
  );
};
