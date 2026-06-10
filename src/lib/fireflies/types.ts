// =============================================================
// Tipos de la GraphQL API de Fireflies (subset que consumimos)
// =============================================================
// Solo los campos que pedimos en la query del handler. Si pedimos más,
// extender acá — NO usar `any`.

export interface FirefliesAttendee {
  displayName: string | null;
  email: string | null;
}

export interface FirefliesSummary {
  overview: string | null;
  action_items: string | null;
  keywords: string[] | string | null;
  bullet_gist: string | null;
  shorthand_bullet: string | null;
  short_summary: string | null;
}

export interface FirefliesTranscript {
  id: string;
  title: string | null;
  /** Milisegundos desde EPOCH (UTC). */
  date: number | null;
  /** Duración en minutos. */
  duration: number | null;
  meeting_link: string | null;
  transcript_url: string | null;
  organizer_email: string | null;
  host_email: string | null;
  participants: string[] | null;
  meeting_attendees: FirefliesAttendee[] | null;
  summary: FirefliesSummary | null;
}

// =============================================================
// GraphQL envelope
// =============================================================

export interface GraphQLError {
  message: string;
  extensions?: { code?: string };
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}
