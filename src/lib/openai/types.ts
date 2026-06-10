// =============================================================
// Tipos del agente de clasificación (OpenAI Chat Completions)
// =============================================================

/** Proyecto candidato que le mostramos al modelo. */
export interface CandidateProject {
  id: number;
  name: string;
}

/** Contexto de la reunión para el prompt. */
export interface MeetingContext {
  title: string | null;
  date: string | null; // legible (es-MX)
  overview: string | null;
  attendees: string[];
}

/** Un action item a clasificar. */
export interface ActionItemInput {
  index: number;
  assignee: string | null;
  text: string;
}

export interface ClassifyInput {
  meeting: MeetingContext;
  candidateProjects: CandidateProject[];
  actionItems: ActionItemInput[];
}

/** Resultado por action item devuelto por el modelo (ya validado). */
export interface AIClassification {
  index: number;
  /** id de un proyecto candidato, o null si ninguno aplica con confianza. */
  project_id: number | null;
  title: string;
  /** Días desde la fecha de la reunión para la entrega tentativa. */
  deadline_offset_days: number;
  confidence: number;
  reasoning: string;
}

// =============================================================
// Envelope de la API de OpenAI (subset que usamos)
// =============================================================

export interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: { message?: string; type?: string };
}
