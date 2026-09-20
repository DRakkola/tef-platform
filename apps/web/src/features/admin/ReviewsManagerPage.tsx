import React, { useEffect, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { fetchReviews, decideReview } from "./api";
import type { ContentReviewItem, ReviewStatus } from "./types";
import { Button } from "@/components/ui/button";

export const ReviewsManagerPage: React.FC = () => {
  const [reviews, setReviews] = useState<ContentReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Decision Modal
  const [decisionModalItem, setDecisionModalItem] = useState<ContentReviewItem | null>(null);
  const [decisionType, setDecisionType] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const data = await fetchReviews({
        status: statusFilter || undefined,
        page: 1,
        page_size: 50,
      });
      setReviews(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to load reviews." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [statusFilter]);

  const handleOpenDecision = (rev: ContentReviewItem, type: "approve" | "reject") => {
    setDecisionModalItem(rev);
    setDecisionType(type);
    setComments(
      type === "approve"
        ? "Examen vérifié et conforme aux normes TEF Canada."
        : "Nécessite des corrections pédagogiques."
    );
  };

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModalItem) return;

    setIsSubmitting(true);
    try {
      await decideReview(decisionModalItem.id, decisionType, comments);
      setMsg({
        type: "success",
        text: `Review marked as ${decisionType.toUpperCase()}!`,
      });
      setDecisionModalItem(null);
      loadReviews();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Decision submission failed." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case "approved":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "rejected":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      default:
        return "bg-amber-950/80 text-amber-300 border-amber-800";
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Clock className="h-6 w-6 text-rose-400" />
              Editorial Review Queue ({total})
            </h1>
            <p className="text-sm text-slate-400">
              Four-eyes peer review gate before educational material is eligible for student simulations.
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
        {msg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between ${
              msg.type === "success"
                ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                : "bg-rose-950/60 border border-rose-800 text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2">
              {msg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {msg.text}
            </span>
            <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">Status:</span>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded font-semibold transition ${
              statusFilter === "pending"
                ? "bg-indigo-600 text-white"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            Pending ({statusFilter === "pending" ? total : "•"})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("approved")}
            className={`px-3 py-1.5 rounded font-semibold transition ${
              statusFilter === "approved"
                ? "bg-emerald-700 text-white"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            Approved
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("rejected")}
            className={`px-3 py-1.5 rounded font-semibold transition ${
              statusFilter === "rejected"
                ? "bg-rose-700 text-white"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            Rejected
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded font-semibold transition ${
              statusFilter === ""
                ? "bg-slate-800 text-white"
                : "bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
        </div>

        {/* Reviews List */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading review items...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm">
            No review items in this state.
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-white text-base capitalize">
                      {rev.entity_type} Item
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800">
                      ID: {rev.entity_id}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      v{rev.version}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border uppercase font-bold ${getStatusBadge(
                        rev.status
                      )}`}
                    >
                      {rev.status}
                    </span>
                  </div>

                  {rev.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenDecision(rev, "approve")}
                        className="h-8 text-xs bg-emerald-700 hover:bg-emerald-600 gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDecision(rev, "reject")}
                        className="h-8 text-xs border-rose-800 text-rose-300 hover:bg-rose-950/40 gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>

                {rev.comments && (
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{rev.comments}</span>
                  </div>
                )}

                <div className="text-2xs text-slate-500 font-mono">
                  Submitted: {new Date(rev.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Decision */}
        {decisionModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {decisionType === "approve" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-400" />
                )}
                {decisionType === "approve" ? "Approve Content" : "Reject Content"}
              </h2>

              <form onSubmit={handleConfirmDecision} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Editorial Feedback / Comments
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDecisionModalItem(null)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    className={`gap-1 ${
                      decisionType === "approve"
                        ? "bg-emerald-700 hover:bg-emerald-600"
                        : "bg-rose-700 hover:bg-rose-600"
                    }`}
                  >
                    Confirm {decisionType === "approve" ? "Approval" : "Rejection"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
