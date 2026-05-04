"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[CopyButton] clipboard error", e);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-vadai-navy-light bg-vadai-navy-light/40 px-2.5 py-1 text-xs text-vadai-text hover:bg-vadai-navy-light hover:border-vadai-cyan/40 transition-colors",
        className
      )}
      aria-label={`Copiar ${label ?? "valor"}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-vadai-success" />
          <span className="text-vadai-success">Copiado</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>{label ?? "Copiar"}</span>
        </>
      )}
    </button>
  );
}
