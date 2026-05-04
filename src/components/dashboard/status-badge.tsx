import { cn } from "@/lib/utils";
import type {
  WebhookConfigStatus,
  WebhookExecutionStatus,
} from "@/types/webhook";

type AnyStatus = WebhookConfigStatus | WebhookExecutionStatus;

const STYLES: Record<AnyStatus, string> = {
  // Config
  pending_handler: "bg-vadai-warning/15 text-vadai-warning border-vadai-warning/30",
  active: "bg-vadai-success/15 text-vadai-success border-vadai-success/30",
  paused: "bg-vadai-muted/15 text-vadai-muted border-vadai-muted/30",
  archived: "bg-vadai-muted/10 text-vadai-muted border-vadai-muted/20",

  // Execution
  received: "bg-vadai-cyan/15 text-vadai-cyan border-vadai-cyan/30",
  pending: "bg-vadai-warning/15 text-vadai-warning border-vadai-warning/30",
  processing:
    "bg-vadai-cyan/15 text-vadai-cyan border-vadai-cyan/30 animate-pulse",
  completed: "bg-vadai-success/15 text-vadai-success border-vadai-success/30",
  completed_with_warning:
    "bg-vadai-warning/15 text-vadai-warning border-vadai-warning/30",
  failed: "bg-vadai-error/15 text-vadai-error border-vadai-error/30",
  skipped_duplicate:
    "bg-vadai-muted/15 text-vadai-muted border-vadai-muted/30",
  skipped_paused: "bg-vadai-muted/15 text-vadai-muted border-vadai-muted/30",
};

const LABELS: Record<AnyStatus, string> = {
  pending_handler: "Sin handler",
  active: "Activo",
  paused: "Pausado",
  archived: "Archivado",
  received: "Recibido",
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  completed_with_warning: "Con warning",
  failed: "Falló",
  skipped_duplicate: "Duplicado",
  skipped_paused: "Saltado (pausa)",
};

export function StatusBadge({
  status,
  className,
}: {
  status: AnyStatus | string;
  className?: string;
}) {
  const styleKey = status as AnyStatus;
  const style =
    STYLES[styleKey] ??
    "bg-vadai-muted/15 text-vadai-muted border-vadai-muted/30";
  const label = LABELS[styleKey] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
