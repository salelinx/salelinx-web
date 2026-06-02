// Support ticket shapes shared by the support UI (the /help/support contact
// form, the /account/tickets history, and the /admin support module). Mirrors
// the support_tickets / support_ticket_replies tables in the shared Supabase
// project (migrations 009 + 012 + 025 + 026 + 028).

export type TicketType = "bug" | "feature" | "feedback" | "other";
export type TicketStatus = "open" | "closed";

export type SupportTicket = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  platform: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Diagnostic metadata (migration 026). Untrusted, display-only.
  app_version: string | null;
  tier_id: string | null;
  source: string | null;
  user_agent: string | null;
  locale: string | null;
};

export type SupportReply = {
  id: string;
  ticket_id: string;
  user_id: string;
  body: string;
  is_admin: boolean;
  created_at: string;
};
