import React, { useState } from "react";
import { MessageSquare, Star, X, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telemetry } from "@/features/analytics/telemetry";

export const MicroFeedbackWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("general");
  const [message, setMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      await fetch("/api/v1/analytics/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          category,
          rating: rating || undefined,
          message: message.trim(),
          context_url: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      telemetry.track("feedback_widget_submitted", { category, rating });
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setMessage("");
        setRating(null);
      }, 2500);
    } catch {
      // fail safe
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 font-sans">
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            telemetry.track("feedback_widget_opened");
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-full shadow-lg shadow-indigo-600/30 font-medium text-xs transition-all cursor-pointer"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Donner votre avis</span>
        </button>
      )}

      {isOpen && (
        <div className="w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <span className="font-bold text-sm text-white">Votre avis compte</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {submitted ? (
            <div className="py-8 text-center space-y-2">
              <div className="mx-auto w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30">
                <Check className="h-5 w-5" />
              </div>
              <div className="font-bold text-sm text-white">Merci pour votre retour !</div>
              <p className="text-xs text-slate-400">Vos remarques nous aident à perfectionner la plateforme.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Note globale (optionnel)
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(star)}
                      className="p-1 text-slate-600 hover:text-amber-400 transition-colors"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          (hoverRating !== null ? hoverRating >= star : (rating || 0) >= star)
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-600"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="general">Général</option>
                  <option value="content">Contenu & Questions</option>
                  <option value="technical">Technique & Bug</option>
                  <option value="ai">Corrections IA</option>
                  <option value="teacher">Professeurs</option>
                  <option value="billing">Facturation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Votre message ou suggestion *
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Qu'avez-vous pensé de cet exercice ou de votre session ?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="border-slate-800 hover:bg-slate-800 text-xs text-slate-400"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !message.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Envoyer</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
