"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function JsonViewer({
  value,
  defaultOpen = false,
  label = "JSON",
}: {
  value: unknown;
  defaultOpen?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const json = JSON.stringify(value, null, 2);
  const lineCount = json.split("\n").length;

  return (
    <div className="rounded-md border border-vadai-navy-light bg-vadai-navy-light/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-vadai-muted hover:text-vadai-text transition-colors"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">{label}</span>
          <span className="text-xs text-vadai-muted">
            {lineCount} línea{lineCount !== 1 ? "s" : ""}
          </span>
        </span>
      </button>

      {open && (
        <pre
          className={cn(
            "max-h-96 overflow-auto border-t border-vadai-navy-light px-3 py-3 text-xs font-mono leading-relaxed text-vadai-text"
          )}
        >
          {json}
        </pre>
      )}
    </div>
  );
}
