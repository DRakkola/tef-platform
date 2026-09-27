/**
 * Custom hook for audio-only WebRTC peer connection and WebSocket signaling.
 * Strictly enforces NO video track requests and handles peer negotiation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@/core/config";
import type { PracticeSignalingMessage, WebRTCAudioConnectionState } from "./types";

interface UsePracticeWebRTCOptions {
  roomId: string;
  sessionId: string;
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  onPeerLeft?: () => void;
  onConnected?: () => void;
  onReconnecting?: () => void;
}

export function usePracticeWebRTC({
  roomId,
  sessionId,
  iceServers = [{ urls: "stun:stun.l.google.com:19302" }],
  onPeerLeft,
  onConnected,
  onReconnecting,
}: UsePracticeWebRTCOptions) {
  const [signalingState, setSignalingState] = useState<
    "connecting" | "connected" | "disconnected" | "error" | "reconnecting"
  >("connecting");
  const [peerState, setPeerState] = useState<WebRTCAudioConnectionState>("initializing");
  const [micPermissionState, setMicPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const isLeavingRef = useRef<boolean>(false);

  // 1. Initialize local audio-only stream
  const setupLocalMedia = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicPermissionState("denied");
      return null;
    }
    try {
      // Strictly audio: true, video: false
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Assert zero video tracks
      if (stream.getVideoTracks().length > 0) {
        stream.getVideoTracks().forEach((track) => track.stop());
      }

      localStreamRef.current = stream;
      setMicPermissionState("granted");

      // Setup audio analyzer for mic level meter
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const pcmData = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(pcmData);
              let sum = 0;
              for (let i = 0; i < pcmData.length; i++) {
                sum += pcmData[i];
              }
              const average = sum / pcmData.length;
              setMicLevel(Math.min(100, Math.round((average / 128) * 100)));
            }
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        } catch {
          // AudioContext initialization fallback
        }
      }

      // If peer connection already exists, add tracks
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        stream.getAudioTracks().forEach((track) => {
          const alreadyAdded = senders.some((s) => s.track === track);
          if (!alreadyAdded) {
            pcRef.current?.addTrack(track, stream);
          }
        });
      }

      return stream;
    } catch (err: any) {
      console.warn("Could not acquire microphone access:", err);
      setMicPermissionState("denied");
      setError("Microphone access unavailable or denied.");
      return null;
    }
  }, []);

  // 2. Initialize WebRTC peer connection
  const createPeerConnection = useCallback(() => {
    if (typeof RTCPeerConnection === "undefined") {
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const msg: PracticeSignalingEnvelopeLike = {
          action: "ice-candidate",
          target_id: remotePeerIdRef.current || undefined,
          audio_only: true,
          data: { candidate: event.candidate.toJSON() },
        };
        wsRef.current.send(JSON.stringify(msg));
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState as WebRTCAudioConnectionState;
      setPeerState(st);
      if (st === "connected") {
        onConnected?.();
      } else if (st === "disconnected" || st === "failed") {
        onReconnecting?.();
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        // Assert audio only
        if (event.track.kind === "audio") {
          setRemoteStream(event.streams[0]);
        }
      }
    };

    // Add local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [iceServers, onConnected, onReconnecting]);

  // 3. Connect to WebSocket signaling server
  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;
    isLeavingRef.current = false;
    const token = localStorage.getItem("auth_token") || "";

    let wsBase = config.wsUrl;
    if (!wsBase) {
      const apiUrl = config.apiUrl;
      if (apiUrl.startsWith("http://") || apiUrl.startsWith("https://")) {
        wsBase = apiUrl.replace(/^http/, "ws");
      } else if (typeof window !== "undefined") {
        // In local dev when Vite runs on 5173/5174, connect directly to FastAPI on 8000
        if (window.location.hostname === "localhost" && /^517\d$/.test(window.location.port)) {
          wsBase = "ws://localhost:8000/api/v1";
        } else {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          const cleanApi = apiUrl.startsWith("/") ? apiUrl : `/${apiUrl}`;
          wsBase = `${protocol}//${window.location.host}${cleanApi}`;
        }
      } else {
        wsBase = "ws://localhost:8000/api/v1";
      }
    }
    const wsUrl = `${wsBase}/practice/ws/${roomId}?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch {
      setSignalingState("error");
      return;
    }

    ws.onopen = async () => {
      if (isCancelled) return;
      setSignalingState("connected");

      await setupLocalMedia();
      createPeerConnection();

      // Announce ready to room
      ws.send(
        JSON.stringify({
          action: "ready",
          audio_only: true,
          data: { session_id: sessionId },
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const data: PracticeSignalingMessage = JSON.parse(event.data);
        if (data.action === "connected") {
          setSignalingState("connected");
        } else if (data.action === "ready") {
          // A peer is ready: create offer if we are the initiator
          remotePeerIdRef.current = data.sender_id || null;
          if (pcRef.current && data.sender_id) {
            const offer = await pcRef.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: false,
            });
            await pcRef.current.setLocalDescription(offer);
            ws.send(
              JSON.stringify({
                action: "offer",
                target_id: data.sender_id,
                audio_only: true,
                data: { sdp: offer.sdp },
              })
            );
          }
        } else if (data.action === "offer" && data.data?.sdp) {
          remotePeerIdRef.current = data.sender_id || null;
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp: data.data.sdp })
            );
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            ws.send(
              JSON.stringify({
                action: "answer",
                target_id: data.sender_id,
                audio_only: true,
                data: { sdp: answer.sdp },
              })
            );
          }
        } else if (data.action === "answer" && data.data?.sdp) {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: data.data.sdp })
            );
          }
        } else if (data.action === "ice-candidate" && data.data?.candidate) {
          if (pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.data.candidate));
          }
        } else if (data.action === "leave") {
          onPeerLeft?.();
        } else if (data.action === "error") {
          setError(data.message || "Signaling error occurred");
        }
      } catch (err) {
        console.warn("Failed to process signaling message:", err);
      }
    };

    ws.onerror = () => {
      if (!isLeavingRef.current) {
        setSignalingState("error");
      }
    };

    ws.onclose = () => {
      if (!isLeavingRef.current) {
        setSignalingState("disconnected");
      }
    };

    return () => {
      isCancelled = true;
      isLeavingRef.current = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ action: "leave", audio_only: true }));
          ws.close();
        } catch {
          // Socket already closed
        }
      }
    };
  }, [roomId, sessionId, setupLocalMedia, createPeerConnection, onPeerLeft]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  }, []);

  return {
    signalingState,
    peerState,
    micPermissionState,
    isMuted,
    micLevel,
    remoteStream,
    error,
    toggleMute,
    requestMicrophone: setupLocalMedia,
  };
}

interface PracticeSignalingEnvelopeLike {
  action: string;
  sender_id?: string;
  sender_alias?: string;
  target_id?: string;
  audio_only?: boolean;
  data?: Record<string, any>;
}
