import React from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  ShieldAlert,
  Ban,
  AlertCircle,
} from "lucide-react";

interface PracticePoolControlsProps {
  isMuted: boolean;
  micLevel: number;
  onToggleMute: () => void;
  onLeaveClick: () => void;
  onReportClick: () => void;
  onBlockClick: () => void;
  micPermissionDenied?: boolean;
  onRequestMic?: () => void;
}

export const PracticePoolControls: React.FC<PracticePoolControlsProps> = ({
  isMuted,
  micLevel,
  onToggleMute,
  onLeaveClick,
  onReportClick,
  onBlockClick,
  micPermissionDenied = false,
  onRequestMic,
}) => {

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
      {/* Mic Permission Denied Banner */}
      {micPermissionDenied && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <span>Microphone access was denied. Please allow microphone access in your browser settings.</span>
          </div>
          {onRequestMic && (
            <button
              type="button"
              onClick={onRequestMic}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs transition-colors shrink-0"
            >
              Enable microphone
            </button>
          )}
        </div>
      )}

      {/* Subtle Local VU Meter */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium">Microphone Level</span>
        <span className="font-mono text-emerald-400 font-bold">
          {isMuted ? "MUTED" : `${micLevel}%`}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-75 ${
            isMuted ? "w-0" : "bg-emerald-500"
          }`}
          style={{ width: isMuted ? "0%" : `${Math.min(100, micLevel)}%` }}
        />
      </div>

      {/* Action Buttons Row */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Primary Control: Mute / Unmute */}
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${
            isMuted
              ? "bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 focus:ring-rose-500"
              : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 focus:ring-emerald-400"
          }`}
        >
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          <span>{isMuted ? "Unmute Microphone" : "Mute Microphone"}</span>
        </button>

        {/* Secondary Control: End Session */}
        <button
          type="button"
          onClick={onLeaveClick}
          aria-label="End Session"
          className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-400"
        >
          <PhoneOff className="size-4 text-rose-400" />
          <span>End Session</span>
        </button>
      </div>

      {/* Safety & Reporting Controls Row */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <button
          type="button"
          onClick={onReportClick}
          className="hover:text-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
        >
          <ShieldAlert className="size-3.5 text-amber-400" />
          <span>Report Peer</span>
        </button>

        <button
          type="button"
          onClick={onBlockClick}
          className="hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
        >
          <Ban className="size-3.5 text-rose-400" />
          <span>Block Peer</span>
        </button>
      </div>
    </div>
  );
};
