import React from "react"

export interface FocusedSpeakingShellProps {
  topBar: React.ReactNode
  reconnectBanner?: React.ReactNode
  children: React.ReactNode
}

export function FocusedSpeakingShell({
  topBar,
  reconnectBanner,
  children,
}: FocusedSpeakingShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Sticky Compact Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur-md shadow-xs">
        {topBar}
      </header>

      {/* Non-blocking Reconnect Banner */}
      {reconnectBanner}

      {/* Centered Main Speaking Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
