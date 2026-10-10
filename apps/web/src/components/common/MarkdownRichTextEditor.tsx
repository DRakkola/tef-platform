import React, { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  Link2,
  Code,
  Eye,
  Edit3,
  Columns,
} from "lucide-react";

interface MarkdownRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

export const MarkdownRichTextEditor: React.FC<MarkdownRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Rédigez ou collez le contenu ici...",
  minHeight = "min-h-[160px]",
  disabled = false,
  label,
  hint,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");

  const insertFormatting = (prefix: string, suffix = "", defaultText = "") => {
    if (disabled || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const selectedText = currentText.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newText =
      currentText.substring(0, start) + replacement + currentText.substring(end);

    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(
        start + prefix.length,
        newCursorPos
      );
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    if (disabled || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const currentText = textarea.value;

    const lineStart = currentText.lastIndexOf("\n", start - 1) + 1;
    const newText =
      currentText.substring(0, lineStart) +
      prefix +
      currentText.substring(lineStart);

    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const insertTable = () => {
    const tableTemplate =
      "\n| Titre 1 | Titre 2 |\n| :--- | :--- |\n| Donnée 1 | Donnée 2 |\n";
    insertFormatting(tableTemplate, "");
  };

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  const renderSimpleMarkdown = (text: string) => {
    if (!text) {
      return (
        <span className="text-muted-foreground/60 italic text-xs">
          Rien à prévisualiser pour le moment.
        </span>
      );
    }

    const lines = text.split("\n");
    return (
      <div className="space-y-2 text-xs text-foreground leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith("### ")) {
            return (
              <h4 key={idx} className="font-bold text-sm text-foreground pt-1">
                {line.replace("### ", "")}
              </h4>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h3 key={idx} className="font-bold text-base text-foreground pt-2 border-b border-border/40 pb-1">
                {line.replace("## ", "")}
              </h3>
            );
          }
          if (line.startsWith("# ")) {
            return (
              <h2 key={idx} className="font-extrabold text-lg text-foreground pt-2">
                {line.replace("# ", "")}
              </h2>
            );
          }
          if (line.startsWith("> ")) {
            return (
              <blockquote
                key={idx}
                className="pl-3 border-l-2 border-primary/60 italic bg-muted/20 py-1 rounded-r text-muted-foreground"
              >
                {line.replace("> ", "")}
              </blockquote>
            );
          }
          if (line.startsWith("- ")) {
            return (
              <li key={idx} className="list-disc list-inside pl-2">
                {line.replace("- ", "")}
              </li>
            );
          }
          if (line.trim() === "") {
            return <div key={idx} className="h-1.5" />;
          }
          return <p key={idx}>{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      {(label || hint) && (
        <div className="flex items-center justify-between text-xs">
          {label && <label className="font-semibold text-foreground">{label}</label>}
          {hint && <span className="text-muted-foreground text-2xs">{hint}</span>}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden focus-within:ring-1 focus-within:ring-primary shadow-2xs transition">
        {/* Formatting Toolbar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/40 border-b border-border text-xs flex-wrap gap-1">
          <div className="flex items-center gap-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => insertFormatting("**", "**", "texte en gras")}
              disabled={disabled || viewMode === "preview"}
              title="Gras (Ctrl+B)"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("*", "*", "texte en italique")}
              disabled={disabled || viewMode === "preview"}
              title="Italique (Ctrl+I)"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <span className="w-px h-4 bg-border mx-1" />
            <button
              type="button"
              onClick={() => insertLinePrefix("## ")}
              disabled={disabled || viewMode === "preview"}
              title="Titre 2"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix("### ")}
              disabled={disabled || viewMode === "preview"}
              title="Titre 3"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </button>
            <span className="w-px h-4 bg-border mx-1" />
            <button
              type="button"
              onClick={() => insertLinePrefix("- ")}
              disabled={disabled || viewMode === "preview"}
              title="Liste à puces"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix("1. ")}
              disabled={disabled || viewMode === "preview"}
              title="Liste numérotée"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix("> ")}
              disabled={disabled || viewMode === "preview"}
              title="Citation ou dialogue"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={insertTable}
              disabled={disabled || viewMode === "preview"}
              title="Insérer un tableau"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("[", "](https://...)", "lien")}
              disabled={disabled || viewMode === "preview"}
              title="Lien hypertexte"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("`", "`", "code")}
              disabled={disabled || viewMode === "preview"}
              title="Code ou balise"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* View Modes */}
          <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border text-2xs">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`px-2 py-0.5 rounded font-medium transition flex items-center gap-1 ${
                viewMode === "edit"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Edit3 className="h-3 w-3" /> Édition
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-2 py-0.5 rounded font-medium transition flex items-center gap-1 ${
                viewMode === "preview"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-3 w-3" /> Aperçu
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-2 py-0.5 rounded font-medium transition hidden sm:flex items-center gap-1 ${
                viewMode === "split"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Columns className="h-3 w-3" /> Partagé
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className={`p-3 ${viewMode === "split" ? "grid grid-cols-2 gap-4" : ""}`}>
          {viewMode !== "preview" && (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className={`w-full bg-transparent resize-y font-mono text-xs text-foreground placeholder:text-muted-foreground/60 outline-hidden leading-relaxed ${minHeight}`}
            />
          )}

          {(viewMode === "preview" || viewMode === "split") && (
            <div
              className={`bg-muted/15 p-3 rounded-lg border border-border/40 overflow-y-auto ${minHeight} ${
                viewMode === "split" ? "border-l pl-4" : ""
              }`}
            >
              {renderSimpleMarkdown(value)}
            </div>
          )}
        </div>

        {/* Status footer */}
        <div className="flex items-center justify-between px-3 py-1 bg-muted/20 border-t border-border/40 text-2xs text-muted-foreground">
          <span>Format Markdown supporté</span>
          <div className="flex items-center gap-3">
            <span>{wordCount} mot{wordCount > 1 ? "s" : ""}</span>
            <span>{charCount} caractère{charCount > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
