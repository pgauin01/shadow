import React from "react";

export default function MarkdownView({ content, className = "" }) {
  if (!content) return null;

  // Split by newlines to handle blocks (headers, lists, paragraphs)
  const lines = content.split("\n");

  return (
    <div className={`space-y-1 ${className}`}>
      {lines.map((line, i) => {
        // 1. HEADERS (# Title)
        if (line.startsWith("# ")) {
          return (
            <h3 key={i} className="text-lg font-bold mt-2 mb-1">
              {parseInline(line.slice(2))}
            </h3>
          );
        }

        // 2. LISTS (- Item)
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-1">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0" />
              <span>{parseInline(line.slice(2))}</span>
            </div>
          );
        }

        // 3. EMPTY LINES (Paragraph breaks)
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }

        // 4. REGULAR PARAGRAPHS
        return (
          <p key={i} className="min-h-[1.5em]">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}

// Helper to handle **Bold** and *Italic* inside lines
function parseInline(text) {
  // We split by standard markdown delimiters
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
