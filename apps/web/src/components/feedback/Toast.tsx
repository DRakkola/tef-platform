/**
 * Toast notification component and context.
 * Provides transient, accessible feedback for user actions.
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "destructive" | "warning" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toast: (options: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
  toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "default", duration = 4500 }: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const newToast: ToastItem = { id, title, description, variant, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a safe fallback if used outside provider (e.g. in tests)
    return {
      toast: () => {},
      dismiss: () => {},
      toasts: [],
    };
  }
  return context;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4 sm:p-0"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const { variant = "default", title, description } = toast;

  const { icon: Icon, styles } = getToastVariant(variant);

  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      aria-live={variant === "destructive" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-bottom-3",
        styles
      )}
    >
      <Icon className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
        aria-label="Fermer la notification"
      >
        <X className="size-4" />
      </button>
    </div>
  );
};

function getToastVariant(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return {
        icon: CheckCircle2,
        styles: "bg-card text-foreground border-emerald-500/40 text-emerald-600 dark:text-emerald-400 [&_p.text-muted-foreground]:text-muted-foreground",
      };
    case "destructive":
      return {
        icon: AlertCircle,
        styles: "bg-destructive text-destructive-foreground border-destructive/60 [&_p]:text-destructive-foreground",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        styles: "bg-card text-foreground border-amber-500/40 text-amber-600 dark:text-amber-400 [&_p.text-muted-foreground]:text-muted-foreground",
      };
    case "info":
      return {
        icon: Info,
        styles: "bg-card text-foreground border-blue-500/40 text-blue-600 dark:text-blue-400 [&_p.text-muted-foreground]:text-muted-foreground",
      };
    default:
      return {
        icon: CheckCircle2,
        styles: "bg-card text-foreground border-border",
      };
  }
}
