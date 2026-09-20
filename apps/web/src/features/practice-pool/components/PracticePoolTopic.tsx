import React, { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { PracticeTopic } from "../types";

interface PracticePoolTopicProps {
  topic: PracticeTopic;
}

export const PracticePoolTopic: React.FC<PracticePoolTopicProps> = ({ topic }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm overflow-hidden transition-all">
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <BookOpen className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Today's Topic</span>
              {topic.level && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {topic.level}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 font-medium line-clamp-1">{topic.title}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-slate-800 cursor-pointer"
        >
          <span>{isCollapsed ? "Show prompt" : "Hide prompt"}</span>
          {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-800/60 space-y-3">
          {topic.description && (
            <p className="text-xs text-slate-400 leading-relaxed">{topic.description}</p>
          )}

          {topic.prompts && topic.prompts.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Suggested Prompts
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {topic.prompts.map((prompt, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2"
                  >
                    <span className="font-bold text-indigo-400 shrink-0">{idx + 1}.</span>
                    <span>{prompt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
