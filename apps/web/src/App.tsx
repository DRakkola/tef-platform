import React from "react";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppRoutes } from "@/routes/AppRoutes";

export function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AppRoutes />
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
