import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Radio,
  Send,
  LogOut,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Layers,
} from "lucide-react";
import {
  acceptPracticeRequest,
  createPracticeRequest,
  getIncomingRequests,
  getPracticeQueueStatus,
  leavePracticeQueue,
  rejectPracticeRequest,
  sendPracticeHeartbeat,
} from "./api";
import type { PracticeQueueStatus, PracticeRequest } from "./types";

export const PracticeQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [queueStatus, setQueueStatus] = useState<PracticeQueueStatus | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<PracticeRequest[]>([]);
  const [isSendingRequest, setIsSendingRequest] = useState<string | null>(null);
  const [isProcessingIncoming, setIsProcessingIncoming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial queue status poll
  const pollStatus = async () => {
    try {
      const status = await getPracticeQueueStatus();
      setQueueStatus(status);

      // If user is no longer in queue and not matching/matched
      if (!status.in_queue) {
        navigate("/practice");
        return;
      }

      // Check incoming invitations
      const incoming = await getIncomingRequests();
      setIncomingRequests(incoming);
    } catch (err: any) {
      console.warn("Queue polling error:", err);
    }
  };

  useEffect(() => {
    pollStatus();
    // Poll status every 4 seconds
    const pollTimer = setInterval(pollStatus, 4000);

    // Heartbeat every 25 seconds
    const heartbeatTimer = setInterval(() => {
      sendPracticeHeartbeat().catch(() => {});
    }, 25000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(heartbeatTimer);
    };
  }, []);

  const handleLeaveQueue = async () => {
    try {
      await leavePracticeQueue();
      navigate("/practice");
    } catch {
      navigate("/practice");
    }
  };

  const handleSendRequest = async (candidateQueueId: string) => {
    setIsSendingRequest(candidateQueueId);
    setError(null);
    try {
      const req = await createPracticeRequest(candidateQueueId, queueStatus?.topic_id || null);
      navigate(`/practice/request/${req.id}`);
    } catch (err: any) {
      setError(err.message || "Could not send invitation. Peer may have just been matched.");
      await pollStatus();
    } finally {
      setIsSendingRequest(null);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setIsProcessingIncoming(requestId);
    setError(null);
    try {
      const session = await acceptPracticeRequest(requestId);
      navigate(`/practice/session/${session.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to accept request. It may have expired.");
      await pollStatus();
    } finally {
      setIsProcessingIncoming(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setIsProcessingIncoming(requestId);
    try {
      await rejectPracticeRequest(requestId);
      setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      await pollStatus();
    } finally {
      setIsProcessingIncoming(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Status Header */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-slate-900 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">Searching for Practice Peers</h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Your anonymous alias:{" "}
                <span className="font-semibold text-white">{queueStatus?.anonymous_alias || "..."}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400">Level: </span>
              <span className="text-xs font-bold text-emerald-400">{queueStatus?.level || "B2"}</span>
            </div>
            <button
              type="button"
              onClick={handleLeaveQueue}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave Pool
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Incoming Practice Invitations Alert */}
        {incomingRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Incoming Practice Invitations ({incomingRequests.length})
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{req.sender_alias}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {req.level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Wants to practice French speaking (25 minutes, audio-only)
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isProcessingIncoming === req.id}
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingIncoming === req.id}
                      onClick={() => handleAcceptRequest(req.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Accept & Start
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compatible Available Candidates */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Compatible Students Online
              </h2>
              <p className="text-xs text-slate-400">
                Ranked by CEFR proximity and waiting queue priority
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
              {queueStatus?.candidates?.length || 0} peers available
            </span>
          </div>

          {(!queueStatus?.candidates || queueStatus.candidates.length === 0) ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-white text-sm">No compatible peers waiting right now</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Keep this page open! You will automatically be notified the moment another student
                joins or invites you.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {queueStatus.candidates.map((cand) => (
                <div
                  key={cand.queue_id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{cand.anonymous_alias}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {cand.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span className="capitalize">{cand.practice_type.replace(/_/g, " ")}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Waiting in pool</span>
                    </div>
                    <button
                      type="button"
                      disabled={isSendingRequest === cand.queue_id}
                      onClick={() => handleSendRequest(cand.queue_id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      {isSendingRequest === cand.queue_id ? "Sending..." : "Practice Together"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
