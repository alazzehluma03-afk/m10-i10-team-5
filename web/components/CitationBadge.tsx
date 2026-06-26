import { useState } from "react";
import type { Citation } from "../lib/types";

interface CitationBadgeProps {
  citation: Citation;
  index: number;
}

export function CitationBadge({ citation, index }: CitationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <span className="inline-block relative">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        data-testid="citation-marker"
        aria-expanded={expanded}
        aria-label={`Citation ${index + 1}, chunk ${citation.chunk_id}`}
        className={[
          "inline-flex items-center justify-center",
          "w-6 h-6 rounded-full",
          "bg-saffron text-charcoal",
          "text-xs font-mono font-bold",
          "transition-all duration-200 cursor-pointer",
          "hover:scale-110 hover:shadow-[0_0_10px_rgba(232,167,26,0.55)]",
          "focus:outline-none focus:ring-2 focus:ring-saffron focus:ring-offset-1",
        ].join(" ")}
      >
        {index + 1}
      </button>

      {expanded && (
        <div
          role="tooltip"
          className={[
            "absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2",
            "w-56 p-3 rounded-lg",
            "bg-charcoal dark:bg-cream",
            "text-cream dark:text-charcoal",
            "text-xs font-mono shadow-xl",
            "animate-fade-in",
          ].join(" ")}
        >
          <p className="font-bold mb-1">Chunk #{citation.chunk_id}</p>
          <p className="text-warm-gray-light dark:text-warm-gray-dark">
            Relevance score: {citation.score.toFixed(3)}
          </p>
          {/* caret pointer */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-charcoal dark:bg-cream rotate-45" />
        </div>
      )}
    </span>
  );
}
