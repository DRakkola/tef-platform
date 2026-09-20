import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  RotateCw,
  Radio,
} from "lucide-react";
import {
  blockPracticePeer,
  getPracticeSession,
  leavePracticeSession,
  reportPracticePeer,
} from "./api";
import { usePracticeWebRTC } from "./usePracticeWebRTC";
import { FocusedPracticePoolShell } from "./components/FocusedPracticePoolShell";
import {
  PracticePoolSessionTopBar,
  type SessionDisplayState,
} from "./components/PracticePoolSessionTopBar";
import { PracticePoolParticipant } from "./components/PracticePoolParticipant";
import { PracticePoolControls } from "./components/PracticePoolControls";
import { PracticePoolTopic } from "./components/PracticePoolTopic";
import {
  LeavePracticeSessionDialog,
  PracticePoolReportDialog,
  PracticePoolBlockDialog,
  AutoplayBlockedBanner,
} from "./components/PracticePoolDialogs";
import { telemetry } from "@/features/analytics/telemetry";
import type { PracticeReportReasonType, PracticeSession } from "./types";

export const PracticeSessionPage: React.FC = () => {
  const params = useParams<{ id?: string; sessionId?: string }>();
  const sessionId = params.sessionId || params.id;
  const navigate = useNavigate();

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(25 * 60);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Derived explicit session display state
  const [sessionState, setSessionState] = useState<SessionDisplayState>("initializing");

  // Autoplay recovery state
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);

  // Dialogs state
  const [showLeaveDialog, setShowLeaveDialog] = useState<boolean>(false);
  const [isLeaving, setIsLeaving] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState<boolean>(false);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasEndedRef = useRef<boolean>(false);

  // 1. Fetch Authoritative Session
  useEffect(() => {
    if (!sessionId) {
      navigate("/practice-pool");
      return;
    }

    getPracticeSession(sessionId)
      .then((data) => {
        setSession(data);
        if (data.remaining_seconds !== undefined && data.remaining_seconds !== null) {
          setRemainingSeconds(data.remaining_seconds);
        } else {
          const exp = new Date(data.expires_at).getTime();
          setRemainingSeconds(Math.max(0, Math.round((exp - Date.now()) / 1000)));
        }

        setIsLoading(false);
        setSessionState("waiting_for_peer");

        telemetry.track("practice_session_opened", {
          session_id: data.id,
          level: data.level,
          practice_type: data.practice_type,
          duration_minutes: data.duration_minutes,
        });
      })
      .catch((err) => {
        setError(err.message || "Failed to load practice session");
        setIsLoading(false);
        setSessionState("failed");

        telemetry.track("practice_session_connection_failed", {
          session_id: sessionId,
          error: err.message,
        });
      });
  }, [sessionId, navigate]);

  // 2. Server-Authoritative Countdown Clock
  useEffect(() => {
    if (!session) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSessionComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  // 3. WebRTC Audio Hook with Callbacks
  const handlePeerLeftCallback = useCallback(() => {
    setSessionState("peer_left");
    telemetry.track("practice_session_partner_left", {
      session_id: sessionId,
    });
  }, [sessionId]);

  const handleConnectedCallback = useCallback(() => {
    setSessionState("connected");
    telemetry.track("practice_session_connected", {
      session_id: sessionId,
    });
  }, [sessionId]);

  const handleReconnectingCallback = useCallback(() => {
    if (!hasEndedRef.current) {
      setSessionState("reconnecting");
      telemetry.track("practice_session_reconnect_started", {
        session_id: sessionId,
      });
    }
  }, [sessionId]);

  const {
    signalingState,
    peerState,
    micPermissionState,
    isMuted,
    micLevel,
    remoteStream,
    toggleMute,
    requestMicrophone,
  } = usePracticeWebRTC({
    roomId: session?.room_id || "",
    sessionId: session?.id || "",
    iceServers: session?.ice_servers,
    onPeerLeft: handlePeerLeftCallback,
    onConnected: handleConnectedCallback,
    onReconnecting: handleReconnectingCallback,
  });

  // Attach remote stream to HTML audio element with autoplay restriction recovery
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current
        .play()
        .then(() => {
          setIsAutoplayBlocked(false);
        })
        .catch((err) => {
          // Autoplay was prevented by browser policy
          if (err.name === "NotAllowedError") {
            setIsAutoplayBlocked(true);
          }
        });
    }
  }, [remoteStream]);

  // Synchronize WebRTC / Signaling states into overall sessionState
  useEffect(() => {
    if (sessionState === "ended" || sessionState === "ending" || sessionState === "failed") {
      return;
    }

    if (signalingState === "error") {
      setSessionState("reconnecting");
    } else if (peerState === "connected" && signalingState === "connected") {
      setSessionState("connected");
    } else if (peerState === "connecting" || signalingState === "connecting") {
      if (sessionState !== "waiting_for_peer") {
        setSessionState("connecting_audio");
      }
    } else if (peerState === "disconnected" || peerState === "failed") {
      setSessionState("reconnecting");
    }
  }, [peerState, signalingState, sessionState]);

  // 4. Session Ending / Cleanup
  const handleSessionComplete = async () => {
    if (hasEndedRef.current || !session) return;
    hasEndedRef.current = true;
    setSessionState("ended");

    telemetry.track("practice_session_completed", {
      session_id: session.id,
      duration_minutes: session.duration_minutes,
    });

    try {
      await leavePracticeSession(session.id);
    } finally {
      navigate(`/practice-pool/session/${session.id}/result`);
    }
  };

  const handleConfirmLeave = async () => {
    if (hasEndedRef.current || !session) return;
    hasEndedRef.current = true;
    setIsLeaving(true);
    setSessionState("ending");

    telemetry.track("practice_session_abandoned", {
      session_id: session.id,
      remaining_seconds: remainingSeconds,
    });

    try {
      await leavePracticeSession(session.id);
    } finally {
      setIsLeaving(false);
      setShowLeaveDialog(false);
      navigate(`/practice-pool/session/${session.id}/result`);
    }
  };

  const handleToggleMute = () => {
    toggleMute();
    if (!isMuted) {
      telemetry.track("practice_session_muted", { session_id: sessionId });
    } else {
      telemetry.track("practice_session_unmuted", { session_id: sessionId });
    }
  };

  const handleReportSubmit = async (reason: PracticeReportReasonType, details?: string) => {
    if (!session) return;
    telemetry.track("practice_session_report_submitted", {
      session_id: session.id,
      reason,
    });
    await reportPracticePeer(session.id, reason, details);
  };

  const handleBlockConfirm = async () => {
    if (!session) return;
    telemetry.track("practice_session_blocked", { session_id: session.id });
    try {
      await blockPracticePeer(session.id, "Blocked by participant during practice session");
      await leavePracticeSession(session.id);
    } finally {
      navigate("/practice-pool");
    }
  };

  const handleEnableAudioAutoplay = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().then(() => {
        setIsAutoplayBlocked(false);
      });
    }
  };

  // --- Render Loading & Error Views ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-emerald-400 text-sm font-semibold p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <RotateCw className="size-5 animate-spin" />
          <span>Connecting to audio practice room...</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-md shadow-2xl">
          <AlertTriangle className="size-10 text-rose-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">Cannot Access Practice Session</h1>
          <p className="text-xs text-slate-400">
            {error || "Session is no longer active or authorization expired."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/practice-pool")}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Return to Practice Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <FocusedPracticePoolShell
      header={
        <PracticePoolSessionTopBar
          sessionState={sessionState}
          signalingState={signalingState}
          peerState={peerState}
          remainingSeconds={remainingSeconds}
          onLeaveClick={() => setShowLeaveDialog(true)}
        />
      }
    >
      {/* Hidden audio tag strictly for WebRTC remote audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="w-full space-y-6">
        {/* Autoplay blocked recovery banner */}
        {isAutoplayBlocked && (
          <AutoplayBlockedBanner onEnableAudio={handleEnableAudioAutoplay} />
        )}

        {/* State Banner: Peer Left */}
        {sessionState === "peer_left" && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-white">Your practice partner left the session.</div>
                <div className="text-xs text-slate-400">
                  You can end this session to view your progress summary or return to the pool.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate("/practice-pool")}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Find another partner
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        )}

        {/* State Banner: Waiting for peer */}
        {sessionState === "waiting_for_peer" && (
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Radio className="size-5 text-indigo-400 animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Waiting for your practice partner...</div>
                <div className="text-xs text-slate-400">
                  Your audio connection will start automatically as soon as your partner joins.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State Banner: Reconnecting */}
        {sessionState === "reconnecting" && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-3 shadow-sm">
            <RotateCw className="size-5 text-amber-400 animate-spin shrink-0" />
            <div>
              <div className="text-sm font-bold text-white">Connection lost. Trying to reconnect...</div>
              <div className="text-xs text-slate-400">
                Your session timer is running. Restoring audio automatically.
              </div>
            </div>
          </div>
        )}

        {/* Main Participant Card */}
        <PracticePoolParticipant
          peerAlias={session.peer_alias}
          peerLevel={session.level}
          myAlias={session.my_alias}
          sessionState={sessionState}
          remoteAudioLevel={sessionState === "connected" ? 40 : 0}
          isPeerMuted={false}
        />

        {/* Optional Secondary Area: Topic Prompts */}
        {session.topic && <PracticePoolTopic topic={session.topic} />}

        {/* Bottom Audio Controls */}
        <PracticePoolControls
          isMuted={isMuted}
          micLevel={micLevel}
          onToggleMute={handleToggleMute}
          onLeaveClick={() => setShowLeaveDialog(true)}
          onReportClick={() => {
            telemetry.track("practice_session_report_started", { session_id: session.id });
            setShowReportModal(true);
          }}
          onBlockClick={() => setShowBlockConfirm(true)}
          micPermissionDenied={micPermissionState === "denied"}
          onRequestMic={requestMicrophone}
        />
      </div>

      {/* Safety & Exit Dialogs */}
      <LeavePracticeSessionDialog
        isOpen={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        onConfirm={handleConfirmLeave}
        isLeaving={isLeaving}
      />

      <PracticePoolReportDialog
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
      />

      <PracticePoolBlockDialog
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={handleBlockConfirm}
      />
    </FocusedPracticePoolShell>
  );
};
