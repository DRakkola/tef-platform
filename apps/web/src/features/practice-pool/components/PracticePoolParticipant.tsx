import React from "react";
import { User, Volume2, MicOff, Radio } from "lucide-react";
import type { SessionDisplayState } from "./PracticePoolSessionTopBar";

interface PracticePoolParticipantProps {
  peerAlias: string;
  peerLevel: string;
  myAlias: string;
  sessionState: SessionDisplayState;
  remoteAudioLevel?: number;
  isPeerMuted?: boolean;
}

export const PracticePoolParticipant: React.FC<PracticePoolParticipantProps> = ({
  peerAlias,
  peerLevel,
  myAlias,
  sessionState,
  remoteAudioLevel = 0,
  isPeerMuted = false,
}) => {
  // Determine peer audio state label
  const getAudioState = () => {
    if (sessionState === "waiting_for_peer") return "Waiting...";
    if (sessionState === "connecting_audio" || sessionState === "peer_joining") return "Connecting...";
    if (sessionState === "reconnecting") return "Reconnecting...";
    if (sessionState === "peer_left") return "Left session";
    if (isPeerMuted) return "Muted";
    if (remoteAudioLevel > 15) return "Speaking";
    return "Listening";
  };

  const audioStateLabel = getAudioState();

  // Extract initials from peerAlias (e.g. "Observateur Calme #12" -> "OC")
  const getInitials = (alias: string) => {
    const parts = alias.split(" ").filter((p) => !p.startsWith("#"));
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return alias.slice(0, 2).toUpperCase() || "PP";
  };

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col items-center text-center space-y-5">
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Practice Partner
        </span>
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {peerAlias || "Practice Partner"}
          </h2>
          {peerLevel && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {peerLevel}
            </span>
          )}
        </div>
      </div>

      {/* Neutral Avatar */}
      <div className="relative">
        <div className="size-24 sm:size-28 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 shadow-inner">
          {peerAlias ? (
            <span className="font-bold text-2xl text-slate-200 tracking-wider">
              {getInitials(peerAlias)}
            </span>
          ) : (
            <User className="size-10 text-slate-400" />
          )}
        </div>

        {/* Status ring when speaking */}
        {audioStateLabel === "Speaking" && (
          <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-60 pointer-events-none" />
        )}
      </div>

      {/* Audio Activity Status & Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          {audioStateLabel === "Speaking" ? (
            <Volume2 className="size-4 text-emerald-400 animate-pulse" />
          ) : audioStateLabel === "Muted" ? (
            <MicOff className="size-4 text-rose-400" />
          ) : audioStateLabel === "Waiting..." ? (
            <Radio className="size-4 text-indigo-400 animate-pulse" />
          ) : (
            <Volume2 className="size-4 text-slate-400" />
          )}

          <span
            className={`text-xs font-bold ${
              audioStateLabel === "Speaking"
                ? "text-emerald-400"
                : audioStateLabel === "Muted"
                ? "text-rose-400"
                : "text-slate-300"
            }`}
          >
            {audioStateLabel}
          </span>
        </div>

        {/* Subtle Audio Activity Indicator (small level dots/bars, not large waveform) */}
        <div className="flex items-center justify-center gap-1.5 h-3">
          {[1, 2, 3, 4, 5].map((idx) => {
            const isActive =
              sessionState === "connected" &&
              !isPeerMuted &&
              remoteAudioLevel > idx * 15;
            return (
              <span
                key={idx}
                className={`w-1.5 rounded-full transition-all duration-100 ${
                  isActive
                    ? "h-3 bg-emerald-400 shadow-xs shadow-emerald-400/50"
                    : "h-1.5 bg-slate-800"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Subtext with self-alias */}
      <div className="pt-2 border-t border-slate-800/80 w-full max-w-xs text-center">
        <span className="text-[11px] text-slate-400">
          Votre pseudonyme : <strong className="text-slate-200">{myAlias || "Apprenant"}</strong>
        </span>
      </div>
    </div>
  );
};
