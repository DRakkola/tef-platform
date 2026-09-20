import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, Send, XCircle } from "lucide-react";
import { cancelPracticeRequest, getOutgoingRequests } from "./api";
import type { PracticeRequest } from "./types";

export const PracticeRequestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<PracticeRequest | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(60);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Waiting for peer to accept...");

  useEffect(() => {
    if (!id) {
      navigate("/practice/queue");
      return;
    }

    const checkStatus = async () => {
      try {
        const outgoing = await getOutgoingRequests();
        const current = outgoing.find((r) => r.id === id);
        if (!current) {
          // If request is no longer in pending outgoing, it was either accepted or expired
          // Let's check if a session was created
          setStatusMessage("Request resolved. Checking session...");
          setTimeout(() => {
            navigate("/practice/queue");
          }, 1500);
          return;
        }

        setRequest(current);
        const expiresAt = new Date(current.expires_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.round((expiresAt - now) / 1000));
        setRemainingSeconds(remaining);

        if (remaining <= 0) {
          setStatusMessage("Request expired.");
          setTimeout(() => navigate("/practice/queue"), 1500);
        }
      } catch {
        // Error reading request
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2500);
    return () => clearInterval(interval);
  }, [id, navigate]);

  const handleCancel = async () => {
    if (!id) return;
    setIsCancelling(true);
    try {
      await cancelPracticeRequest(id);
      navigate("/practice/queue");
    } catch {
      navigate("/practice/queue");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6">
        {/* Animated Radar Pulse */}
        <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Send className="w-8 h-8 animate-bounce" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-white">Practice Invitation Sent</h1>
          <p className="text-sm text-slate-400">
            Invited <span className="font-bold text-white">{request?.receiver_alias || "Peer"}</span> for a 25-minute speaking practice.
          </p>
        </div>

        {/* 60s Countdown Timer */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-3">
          <Clock className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-slate-400">Time to respond:</span>
          <span className="font-mono text-lg font-bold text-amber-300">
            {remainingSeconds}s
          </span>
        </div>

        <p className="text-xs text-slate-500">{statusMessage}</p>

        {/* Cancel Action */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isCancelling}
            onClick={handleCancel}
            className="w-full py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            {isCancelling ? "Cancelling..." : "Cancel Invitation"}
          </button>
        </div>
      </div>
    </div>
  );
};
