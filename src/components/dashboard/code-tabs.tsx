"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/dashboard/copy-button";

/**
 * Bloque de código con copiar. Con más de un snippet muestra pestañas
 * (curl / JavaScript / Python…); con uno solo, sólo el encabezado.
 */
export function CodeTabs({
  snippets,
}: {
  snippets: { label: string; code: string }[];
}) {
  const [active, setActive] = useState(0);
  const current = snippets[active] ?? snippets[0];

  return (
    <div className="overflow-hidden rounded-md border border-vadai-navy-light bg-vadai-navy">
      <div className="flex items-center justify-between gap-2 border-b border-vadai-navy-light bg-vadai-navy-light/30 px-2 py-1.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {snippets.length > 1 ? (
            snippets.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition-colors",
                  i === active
                    ? "bg-vadai-navy-light text-vadai-text"
                    : "text-vadai-muted hover:text-vadai-text"
                )}
              >
                {s.label}
              </button>
            ))
          ) : (
            <span className="px-2.5 py-1 text-xs text-vadai-muted">
              {current.label}
            </span>
          )}
        </div>
        <CopyButton value={current.code} label="Copiar" />
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-vadai-text">
        <code className="font-mono">{current.code}</code>
      </pre>
    </div>
  );
}
