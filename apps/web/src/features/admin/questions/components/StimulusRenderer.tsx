import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Table as TableIcon,
  Headphones,
  Layers,
  Clock,
  ExternalLink,
  Maximize2,
  Minimize2,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface StimulusRendererProps {
  title?: string | null;
  content: string | null | undefined;
  modality?: string | null;
  textFormat?: "plain" | "markdown" | "table" | "multi_doc" | string | null;
  sourceCitation?: string | null;
  cefrLevel?: string | null;
  wordCount?: number | null;
  viewMode?: "full" | "split" | "compact";
  activeDocumentKey?: string | null;
  onSelectDocument?: (docKey: string) => void;
  className?: string;
  enableExpandModal?: boolean;
}

interface ParsedDocument {
  key: string;
  label: string;
  title: string;
  body: string;
}

export const StimulusRenderer: React.FC<StimulusRendererProps> = ({
  title,
  content,
  modality = "reading",
  textFormat,
  sourceCitation,
  cefrLevel,
  wordCount,
  viewMode = "full",
  activeDocumentKey,
  onSelectDocument,
  className = "",
  enableExpandModal = true,
}) => {
  const [selectedDocTab, setSelectedDocTab] = useState<string>("all");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Compute calculated word count if not passed
  const calculatedWordCount = useMemo(() => {
    if (wordCount) return wordCount;
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content, wordCount]);

  // Estimated reading time (~180 words per minute for B1/B2 French readers)
  const estimatedReadingTime = useMemo(() => {
    if (!calculatedWordCount) return null;
    const seconds = Math.max(15, Math.round((calculatedWordCount / 180) * 60));
    if (seconds < 60) return `~${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    return `~${mins} min`;
  }, [calculatedWordCount]);

  // Detect format if not explicitly provided
  const detectedFormat = useMemo(() => {
    if (textFormat && textFormat !== "plain_text" && textFormat !== "plain") {
      return textFormat;
    }
    if (!content) return "plain";
    if (
      content.includes("### Document") ||
      (content.includes("Document A") && content.includes("Document B"))
    ) {
      return "multi_doc";
    }
    if (
      content.includes("|") &&
      content.split("\n").some((l) => l.trim().startsWith("|"))
    ) {
      return "table";
    }
    if (
      modality === "listening" ||
      textFormat === "audio_transcript" ||
      content.includes("[Sonnerie") ||
      content.includes("[Audio") ||
      content.includes("[Micro-trottoir") ||
      content.includes("Locuteur 1") ||
      (content.startsWith("[") && content.includes("]"))
    ) {
      return "audio_transcript";
    }
    return "plain";
  }, [content, textFormat, modality]);

  // Parse multi-documents if format is multi_doc
  const parsedDocuments = useMemo<ParsedDocument[]>(() => {
    if (!content || detectedFormat !== "multi_doc") return [];

    const rawSections = content
      .split(/(?=^\s*(?:###|={2,3})?\s*Document\s+[A-D]\b)/gim)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    if (rawSections.length > 1) {
      return rawSections.map((sec, idx) => {
        const lines = sec.split("\n");
        const cleanFirstLine = lines[0].replace(/^[#=\s]+/, "").replace(/[#=\s]+$/, "").trim();
        const parts = cleanFirstLine.split(":");
        const rawLabel = parts[0]?.trim() || `Document ${String.fromCharCode(65 + idx)}`;
        const normalizedLabel = rawLabel.replace(/^doc(?:ument)?\s+/i, "Document ");
        const docTitle = parts.slice(1).join(":").trim();
        const bodyLines = lines.slice(1).filter((l) => !l.trim().startsWith("===") && !l.trim().endsWith("==="));
        const body = bodyLines.join("\n").trim();
        const uniqueKey = `doc_${String.fromCharCode(97 + idx)}`;
        return {
          key: uniqueKey,
          label: normalizedLabel,
          title: docTitle,
          body: body || sec,
        };
      });
    }

    return [];
  }, [content, detectedFormat]);

  if (!content || !content.trim()) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground">
        Aucun contenu de support disponible.
      </div>
    );
  }

  // --- Sub-renderer: Multi-Documents (A/B/C/D) ---
  const renderMultiDocuments = () => {
    const docsToDisplay =
      selectedDocTab === "all"
        ? parsedDocuments
        : parsedDocuments.filter((d) => d.key.toLowerCase().includes(selectedDocTab.toLowerCase()));

    const colors = [
      {
        border: "border-emerald-500/40 dark:border-emerald-500/30",
        bg: "bg-emerald-500/5 dark:bg-emerald-950/20",
        badge: "bg-emerald-600 text-white",
        ring: "ring-emerald-500/50",
      },
      {
        border: "border-blue-500/40 dark:border-blue-500/30",
        bg: "bg-blue-500/5 dark:bg-blue-950/20",
        badge: "bg-blue-600 text-white",
        ring: "ring-blue-500/50",
      },
      {
        border: "border-amber-500/40 dark:border-amber-500/30",
        bg: "bg-amber-500/5 dark:bg-amber-950/20",
        badge: "bg-amber-600 text-white",
        ring: "ring-amber-500/50",
      },
      {
        border: "border-purple-500/40 dark:border-purple-500/30",
        bg: "bg-purple-500/5 dark:bg-purple-950/20",
        badge: "bg-purple-600 text-white",
        ring: "ring-purple-500/50",
      },
    ];

    return (
      <div className="space-y-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => setSelectedDocTab("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              selectedDocTab === "all"
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            Tous les documents ({parsedDocuments.length})
          </button>
          {parsedDocuments.map((doc, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isTabActive =
              selectedDocTab === doc.key || selectedDocTab.toLowerCase() === `document ${letter.toLowerCase()}`;
            return (
              <button
                key={doc.key}
                type="button"
                onClick={() => {
                  setSelectedDocTab(doc.key);
                  if (onSelectDocument) onSelectDocument(doc.key);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                  isTabActive
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-3xs font-bold">
                  {letter}
                </span>
                <span>Doc {letter}</span>
              </button>
            );
          })}
        </div>

        {/* Cards Grid */}
        <div
          className={`grid gap-3 ${
            selectedDocTab === "all"
              ? viewMode === "split"
                ? "grid-cols-1"
                : "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {docsToDisplay.map((doc, idx) => {
            const colorIdx = idx % colors.length;
            const theme = colors[colorIdx];
            const isHighlighted =
              activeDocumentKey &&
              (doc.key.toLowerCase().includes(activeDocumentKey.toLowerCase()) ||
                activeDocumentKey.toLowerCase().includes(doc.key.toLowerCase()));

            return (
              <div
                key={doc.key}
                className={`p-3.5 rounded-xl border transition-all ${theme.border} ${theme.bg} ${
                  isHighlighted ? `ring-2 ${theme.ring} shadow-md` : "shadow-2xs"
                } flex flex-col justify-between gap-2`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-2xs font-extrabold uppercase tracking-wide ${theme.badge}`}
                    >
                      {doc.label}
                    </span>
                    {doc.title && (
                      <span className="font-bold text-xs text-foreground truncate max-w-[200px]">
                        {doc.title}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line font-normal">
                    {doc.body}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/40 text-3xs text-muted-foreground flex items-center justify-between">
                  <span>{doc.body.split(/\s+/).filter(Boolean).length} mots</span>
                  <span className="font-mono">TEF Section A</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- Sub-renderer: Markdown Tables (Statistical Infographics) ---
  const renderTable = () => {
    const lines = content.split("\n").filter((l) => l.trim().startsWith("|"));
    if (lines.length < 2) {
      return (
        <p className="text-xs text-foreground whitespace-pre-line leading-relaxed font-mono">
          {content}
        </p>
      );
    }

    const headerCells = lines[0].split("|").map((c) => c.trim()).filter(Boolean);
    const dataRows = lines.slice(lines[1].includes("---") ? 2 : 1);

    return (
      <div className="space-y-2">
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/80 text-foreground font-bold border-b border-border text-2xs uppercase tracking-wide">
              <tr>
                {headerCells.map((h, i) => (
                  <th
                    key={i}
                    className={`px-3.5 py-2.5 border-r border-border last:border-r-0 ${
                      i > 0 ? "text-center" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dataRows.map((r, rIdx) => {
                const cells = r.split("|").map((c) => c.trim()).filter(Boolean);
                return (
                  <tr
                    key={rIdx}
                    className={`transition-colors ${
                      rIdx % 2 === 0 ? "bg-background" : "bg-muted/20"
                    } hover:bg-muted/40`}
                  >
                    {cells.map((c, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-3.5 py-2 border-r border-border last:border-r-0 ${
                          cIdx === 0
                            ? "font-semibold text-foreground text-xs"
                            : "font-mono text-2xs text-muted-foreground text-center"
                        }`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-3xs text-muted-foreground italic text-right">
          Données statistiques réparties pour l'épreuve de compréhension écrite
        </p>
      </div>
    );
  };

  // --- Sub-renderer: Audio Transcripts & Spoken Dialogue ---
  const renderAudioTranscript = () => {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    return (
      <div className="space-y-2.5">
        {lines.map((line, idx) => {
          // Acoustic cues: [Sonnette], [Micro-trottoir], etc.
          if (line.startsWith("[") && line.includes("]")) {
            const cueEnd = line.indexOf("]") + 1;
            const cue = line.slice(0, cueEnd);
            const remainder = line.slice(cueEnd).trim();
            return (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-xs text-foreground/90 space-y-1"
              >
                <div className="flex items-center gap-1.5 text-2xs font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                  <Volume2 className="h-3.5 w-3.5 text-cyan-600" />
                  {cue}
                </div>
                {remainder && <div className="italic pl-5 font-serif">{remainder}</div>}
              </div>
            );
          }

          // Speaker turns: e.g. "Madame Dupont : Bonjour...", "Agent immobilier : Entrez..."
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0 && colonIdx <= 40) {
            const speaker = line.slice(0, colonIdx).trim();
            const speech = line.slice(colonIdx + 1).trim();
            return (
              <div key={idx} className="p-3 rounded-xl border border-border bg-card shadow-2xs flex gap-3">
                <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                  {speaker[0]}
                </div>
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-foreground text-2xs uppercase tracking-wide block">
                    {speaker}
                  </span>
                  <p className="text-foreground/90 leading-relaxed font-serif italic">
                    {speech}
                  </p>
                </div>
              </div>
            );
          }

          // Default dialogue block
          return (
            <p
              key={idx}
              className="text-xs text-foreground leading-relaxed p-2.5 rounded-lg bg-card border border-border font-serif"
            >
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  // --- Sub-renderer: Standard Press Article / Text ---
  const renderStandardArticle = () => {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line font-serif bg-card/60 p-4 rounded-xl border border-border shadow-2xs">
          {content}
        </p>
      </div>
    );
  };

  return (
    <div
      className={`rounded-2xl border border-border bg-card/40 backdrop-blur-xs transition-all ${className} ${
        isExpanded ? "p-6" : "p-4"
      }`}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            {detectedFormat === "multi_doc" ? (
              <Layers className="h-4 w-4" />
            ) : detectedFormat === "table" ? (
              <TableIcon className="h-4 w-4" />
            ) : detectedFormat === "audio_transcript" ? (
              <Headphones className="h-4 w-4" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5 truncate max-w-[280px]">
              {title || "Support documentaire officiel"}
            </h4>
            <span className="text-3xs text-muted-foreground flex items-center gap-2">
              <span className="capitalize">{modality}</span>
              <span>•</span>
              <span className="capitalize">
                {detectedFormat === "multi_doc"
                  ? "Multi-documents A/B/C/D"
                  : detectedFormat === "table"
                  ? "Tableau statistique"
                  : detectedFormat === "audio_transcript"
                  ? "Transcription audio"
                  : "Article de presse"}
              </span>
            </span>
          </div>
        </div>

        {/* Badges & Actions */}
        <div className="flex items-center gap-2">
          {cefrLevel && (
            <Badge className="bg-purple-600 text-white font-extrabold text-3xs px-2 py-0.5">
              {cefrLevel}
            </Badge>
          )}

          {estimatedReadingTime && (
            <span className="hidden sm:flex items-center gap-1 text-3xs text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded-md border border-border">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {calculatedWordCount} mots ({estimatedReadingTime})
            </span>
          )}

          {enableExpandModal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title={isExpanded ? "Réduire" : "Agrandir"}
            >
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className={`overflow-y-auto ${isExpanded ? "max-h-[70vh]" : viewMode === "split" ? "max-h-[480px]" : "max-h-[400px]"} pr-1`}>
        {detectedFormat === "multi_doc"
          ? renderMultiDocuments()
          : detectedFormat === "table"
          ? renderTable()
          : detectedFormat === "audio_transcript"
          ? renderAudioTranscript()
          : renderStandardArticle()}
      </div>

      {/* Footer Attribution */}
      {sourceCitation && (
        <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-3xs text-muted-foreground">
          <span className="flex items-center gap-1 italic truncate">
            <ExternalLink className="h-3 w-3 text-purple-600" />
            Source : {sourceCitation}
          </span>
          <span className="font-semibold text-purple-600 uppercase tracking-wider">
            Format certifié TEF
          </span>
        </div>
      )}
    </div>
  );
};
