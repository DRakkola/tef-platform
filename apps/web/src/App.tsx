import React from "react";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/features/auth";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/components/feedback/Toast";
import { AppRoutes } from "@/routes/AppRoutes";

export function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
