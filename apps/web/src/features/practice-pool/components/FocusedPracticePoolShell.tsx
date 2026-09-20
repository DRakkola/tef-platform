import React from "react";

interface FocusedPracticePoolShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
}

export const FocusedPracticePoolShell: React.FC<FocusedPracticePoolShellProps> = ({
  children,
  header,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      {/* Focused Top Bar */}
      {header && (
        <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {header}
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
        {children}
      </main>
    </div>
  );
};
