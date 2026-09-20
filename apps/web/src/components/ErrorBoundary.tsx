/**
 * Production error boundary component.
 * Catches unhandled React render errors and displays a resilient, localized French recovery screen.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, HelpCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  public handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public handleNavigate = (path: string): void => {
    this.setState({ hasError: false, error: null });
    window.location.href = path;
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground"
        >
          <div className="w-16 h-16 mb-4 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Une erreur inattendue est survenue</h1>
          <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
            Une anomalie temporaire est survenue dans l'application. Notre équipe technique
            a été automatiquement notifiée pour résoudre la situation.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={this.handleReset} variant="default" className="gap-2 cursor-pointer">
              <RefreshCw className="w-4 h-4" />
              Recharger la page
            </Button>
            <Button
              onClick={() => this.handleNavigate("/dashboard")}
              variant="outline"
              className="gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Retour au tableau de bord
            </Button>
            <Button
              onClick={() => this.handleNavigate("/help")}
              variant="ghost"
              className="gap-2 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              Centre d'aide
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
