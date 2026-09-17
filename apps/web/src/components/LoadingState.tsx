/**
 * Accessible loading state component.
 */

import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading platform data...",
  className = "",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 gap-3 text-muted-foreground ${className}`}
    >
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};
