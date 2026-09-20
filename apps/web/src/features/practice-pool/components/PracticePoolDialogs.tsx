import React, { useState } from "react";
import { ShieldAlert, Ban, PhoneOff, CheckCircle2, Volume2 } from "lucide-react";
import type { PracticeReportReasonType } from "../types";

// --- 1. Leave Practice Session Dialog ---
interface LeaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLeaving?: boolean;
}

export const LeavePracticeSessionDialog: React.FC<LeaveDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLeaving = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="size-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
          <PhoneOff className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-white text-base">Leave practice session?</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your current practice session will end. Any completed speaking time will be saved to your profile.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Continue session
          </button>
          <button
            type="button"
            disabled={isLeaving}
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLeaving ? "Leaving..." : "Leave"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 2. Report Peer Dialog ---
interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: PracticeReportReasonType, details?: string) => Promise<void>;
}

export const PracticePoolReportDialog: React.FC<ReportDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState<PracticeReportReasonType>("inappropriate_behavior");
  const [details, setDetails] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(reason, details);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setDetails("");
        onClose();
      }, 1500);
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-400" />
            <span>Report Practice Peer</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Report submitted for review. Thank you for keeping the community safe.</span>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as PracticeReportReasonType)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="inappropriate_behavior">Inappropriate Behavior</option>
                <option value="offensive_language">Offensive Language / Profanity</option>
                <option value="harassment">Harassment</option>
                <option value="silence_or_afk">Prolonged Silence / AFK</option>
                <option value="contact_exchange_attempt">Attempting to exchange personal contact details</option>
                <option value="audio_quality_issues">Severe Audio Quality / Interference</option>
                <option value="spam">Spam or Commercial Solicitation</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Details (Optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Provide additional context for safety moderation..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

// --- 3. Block Peer Dialog ---
interface BlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const PracticePoolBlockDialog: React.FC<BlockDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isBlocking, setIsBlocking] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleBlock = async () => {
    setIsBlocking(true);
    try {
      await onConfirm();
    } finally {
      setIsBlocking(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="size-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
          <Ban className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-white text-base">Block participant?</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            You won't be matched with this learner again according to the platform's blocking rules.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isBlocking}
            onClick={handleBlock}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer disabled:opacity-50"
          >
            {isBlocking ? "Blocking..." : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 4. Autoplay Blocked Banner ---
interface AutoplayBannerProps {
  onEnableAudio: () => void;
}

export const AutoplayBlockedBanner: React.FC<AutoplayBannerProps> = ({ onEnableAudio }) => {
  return (
    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2">
        <Volume2 className="size-4 shrink-0 text-amber-400" />
        <span>Tap to enable audio: your browser blocked automatic sound playback.</span>
      </div>
      <button
        type="button"
        onClick={onEnableAudio}
        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shrink-0 cursor-pointer"
      >
        Enable audio
      </button>
    </div>
  );
};
