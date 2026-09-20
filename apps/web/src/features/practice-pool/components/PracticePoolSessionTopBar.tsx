import React from "react";
import { Clock, PhoneOff, Radio, AlertTriangle, CheckCircle2, RotateCw } from "lucide-react";
import type { WebRTCAudioConnectionState } from "../types";

export type SessionDisplayState =
  | "initializing"
  | "microphone_required"
  | "waiting_for_peer"
  | "peer_joining"
  | "connecting_audio"
  | "connected"
  | "reconnecting"
  | "peer_left"
  | "ending"
  | "ended"
  | "failed";

interface PracticePoolSessionTopBarProps {
  sessionState: SessionDisplayState;
  signalingState: "connecting" | "connected" | "disconnected" | "error" | "reconnecting";
  peerState: WebRTCAudioConnectionState;
  remainingSeconds: number;
  onLeaveClick: () => void;
}

export const PracticePoolSessionTopBar: React.FC<PracticePoolSessionTopBarProps> = ({
  sessionState,
  remainingSeconds,
  onLeaveClick,
}) => {
  const minutes = Math.floor(Math.max(0, remainingSeconds) / 60);
  const seconds = Math.max(0, remainingSeconds) % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isLowTime = remainingSeconds < 300; // < 5 mins
  const isCriticalTime = remainingSeconds < 60; // < 1 min

  // Connection status styling and label
  const renderConnectionStatus = () => {
    switch (sessionState) {
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            <span>Connected</span>
          </span>
        );
      case "reconnecting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">
            <RotateCw className="size-3.5 animate-spin" />
            <span>Reconnecting...</span>
          </span>
        );
      case "waiting_for_peer":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            <Radio className="size-3.5 animate-pulse" />
            <span>Waiting for partner...</span>
          </span>
        );
      case "peer_joining":
      case "connecting_audio":
      case "initializing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
            <RotateCw className="size-3.5 animate-spin" />
            <span>Connecting...</span>
          </span>
        );
      case "peer_left":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="size-3.5" />
            <span>Partner left</span>
          </span>
        );
      case "failed":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <AlertTriangle className="size-3.5" />
            <span>Connection lost</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full flex items-center justify-between gap-4">
      {/* Left: Brand title */}
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shadow-xs">
          TEF
        </div>
        <div>
          <span className="text-sm font-bold text-white tracking-tight">Practice Pool</span>
          <span className="text-[11px] text-slate-400 block -mt-0.5">Audio-Only Live</span>
        </div>
      </div>

      {/* Center / Right: Connection Status & Authoritative Timer */}
      <div className="flex items-center gap-3 sm:gap-4">
        {renderConnectionStatus()}

        <div
          aria-label={`Temps restant : ${timeFormatted}`}
          className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg font-mono text-sm sm:text-base font-bold border transition-colors ${
            isCriticalTime
              ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse"
              : isLowTime
              ? "bg-amber-500/15 border-amber-500 text-amber-300"
              : "bg-slate-900 border-slate-800 text-emerald-400"
          }`}
        >
          <Clock className="size-3.5 sm:size-4" />
          <span>{timeFormatted}</span>
        </div>

        {/* Far Right: Leave */}
        <button
          type="button"
          onClick={onLeaveClick}
          aria-label="Leave practice session"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-colors cursor-pointer"
        >
          <PhoneOff className="size-3.5" />
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
};
