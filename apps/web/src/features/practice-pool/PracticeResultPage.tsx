import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Sparkles,
  Clock,
  UserCheck,
  Home,
  RotateCcw,
} from "lucide-react";
import { getPracticeSession } from "./api";
import type { PracticeSession } from "./types";

export const PracticeResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [fluidityRating, setFluidityRating] = useState<number>(4);
  const [vocabRating, setVocabRating] = useState<number>(4);

  useEffect(() => {
    if (id) {
      getPracticeSession(id)
        .then((data) => setSession(data))
        .catch(() => {});
    }
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-xl space-y-8">
        {/* Celebration Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Practice Session Complete!</h1>
          <p className="text-sm text-slate-400">
            Great work! You just completed 25 minutes of audio speaking practice in French.
          </p>
        </div>

        {/* Session Summary Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Session Overview
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Duration</span>
              </div>
              <p className="font-bold text-white text-sm">25 Minutes</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Peer Alias</span>
              </div>
              <p className="font-bold text-white text-sm">{session?.peer_alias || "Peer"}</p>
            </div>
          </div>

          {session?.topic && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400">Topic: {session.topic.category}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {session.topic.level}
                </span>
              </div>
              <p className="font-semibold text-white text-sm">{session.topic.title}</p>
              <p className="text-xs text-slate-400">{session.topic.description}</p>
            </div>
          )}
        </div>

        {/* Self-Reflection & Confidence Rating */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Personal Self-Reflection
          </h2>

          {/* Fluidity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Speaking Fluidity & Spontaneity</span>
              <span className="font-bold text-emerald-400">{fluidityRating} / 5</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFluidityRating(star)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    star <= fluidityRating
                      ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                      : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                  }`}
                >
                  ★ {star}
                </button>
              ))}
            </div>
          </div>

          {/* Vocabulary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>French Vocabulary Recall</span>
              <span className="font-bold text-indigo-400">{vocabRating} / 5</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setVocabRating(star)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                    star <= vocabRating
                      ? "bg-indigo-500/20 border-indigo-500/60 text-indigo-300"
                      : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700"
                  }`}
                >
                  ★ {star}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate("/practice")}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Practice Again
          </button>
        </div>
      </div>
    </div>
  );
};
