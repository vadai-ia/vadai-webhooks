"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  XCircle,
} from "lucide-react";
import type { Step } from "@/types/webhook";

const ICONS = {
  info: <Circle className="h-4 w-4 text-vadai-cyan" />,
  success: <CheckCircle2 className="h-4 w-4 text-vadai-success" />,
  warn: <AlertTriangle className="h-4 w-4 text-vadai-warning" />,
  error: <XCircle className="h-4 w-4 text-vadai-error" />,
} as const;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function Timeline({ steps }: { steps: Step[] }) {
  if (!steps || steps.length === 0) {
    return (
      <p className="text-sm text-vadai-muted italic">
        No se registraron pasos.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-vadai-navy-light pl-6">
      {steps.map((step, idx) => (
        <TimelineItem key={idx} step={step} />
      ))}
    </ol>
  );
}

function TimelineItem({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const hasData = step.data !== undefined && step.data !== null;

  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-vadai-navy ring-2 ring-vadai-navy-light">
        {ICONS[step.status]}
      </span>
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-mono text-vadai-muted">
          {formatTime(step.ts)}
        </span>
        <span className="text-sm font-medium text-vadai-text">{step.name}</span>
      </div>
      {step.message && (
        <p className="mt-1 text-sm text-vadai-muted">{step.message}</p>
      )}
      {hasData && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-vadai-muted hover:text-vadai-text transition-colors"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>data</span>
          </button>
          {open && (
            <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-vadai-navy-light bg-vadai-navy-light/30 p-2 text-xs font-mono text-vadai-text">
              {JSON.stringify(step.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}
