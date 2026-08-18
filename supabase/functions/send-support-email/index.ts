// deno-lint-ignore-file
// Supabase Database Webhook target. Two webhooks point at this function:
//
//   1. INSERT on public.support_tickets         -> "new ticket" notification
//   2. INSERT on public.support_ticket_replies  -> "new reply"  notification
//                                                  (skipped when is_admin = true)
//
// Both fire on Supabase's Database Webhooks feature, NOT pg_net. They send
// the standard webhook payload:
//
//   { type: "INSERT", table: "support_tickets" | "support_ticket_replies",
//     schema: "public", record: {...}, old_record: null }
//
// Auth: this function is verify_jwt = false (the gateway can't verify the
// project's ES256 service-role JWT anyway). We gate access with a shared
// secret sent as a custom header from the Database Webhook config:
//
//   x-support-webhook-secret: <SUPPORT_NOTIFY_HOOK_SECRET>
//
// Threading: the first email sent for a ticket is delivered, Resend returns
// a Message-ID, we UPDATE support_tickets.notification_message_id with it.
// Reply notifications fetch that value and set In-Reply-To + References so
// Gmail threads them.
//
// One-way: replies that land in support@salelinx.com's Gmail do NOT loop
// back into the panel yet. That's a future addition.
//
// Because of that, USER-FACING mail (auto-ack + admin reply) sets reply_to to
// SUPPORT_NOTIFY_NOREPLY and tells the reader to answer on their ticket.
// Previously it said "Reply to this email", which silently dropped the answer:
// it reached a mailbox but never became a support_ticket_replies row, so it was
// invisible in the extension, on the website, and in the admin console. Staff
// notifications still carry reply_to: userEmail so the team can choose to mail
// a customer directly.


import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  EMAIL_ASSETS,
  emailLayout,
  escapeHtml,
  FONT_STACK,
  heading,
  metaRow,
  metaTable,
  panel,
  paragraph,
  theme,
  button,
} from "../_shared/email-theme.ts";
import { timingSafeEqual } from "../_shared/security.ts";

// ============================================================================
// Email rendering (subject + HTML + plaintext). Kept inline so the Supabase
// Dashboard's single-file deploy UI can bundle this function as one upload.
// If you ever switch to deploying via the local Supabase CLI
// (`supabase functions deploy`), feel free to extract this block back into
// a sibling templates.ts - the CLI bundles whole folders.
// ============================================================================

const TICKETS_URL = "https://salelinx.com/account/tickets";

// Replies by email are not ingested anywhere, so every user-facing template
// says so once, in the same words, and links to the thread instead.
const NO_REPLY_NOTE =
  "Replies to this email aren't monitored - please answer on your ticket so the team sees it.";

type TicketType = "bug" | "feature" | "feedback" | "other";

const TYPE_LABEL: Record<TicketType, string> = {
  bug: "Bug",
  feature: "Feature",
  feedback: "Feedback",
  other: "Other",
};

function typeLabel(type: string): string {
  return TYPE_LABEL[type as TicketType] ?? "Support";
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max).trimEnd() + "...";
}

function formatBody(body: string): string {
  return escapeHtml(body).replace(/\n/g, "<br />");
}

type NewTicketInput = {
  ticketId: string;
  type: string;
  message: string;
  platform: string | null;
  userId: string;
  userEmail: string;
  createdAt: string;
};

type NewReplyInput = {
  ticketId: string;
  ticketType: string;
  ticketSubjectPreview: string;
  replyBody: string;
  replyAuthorEmail: string;
  replyAuthorUserId: string;
  createdAt: string;
};

type Rendered = {
  subject: string;
  html: string;
  text: string;
};

function renderNewTicket(input: NewTicketInput): Rendered {
  const subject = `[${typeLabel(input.type)}] ${truncate(input.message, 50)}`;

  const metaRows = [
    metaRow("Type", escapeHtml(typeLabel(input.type))),
    input.platform ? metaRow("Platform", escapeHtml(input.platform)) : "",
    metaRow("From", escapeHtml(input.userEmail)),
    metaRow("User ID", escapeHtml(input.userId)),
    metaRow("Ticket ID", escapeHtml(input.ticketId)),
    metaRow("Created", escapeHtml(input.createdAt)),
  ].join("");

  const html = emailLayout({
    preheader: truncate(input.message, 90),
    eyebrow: "New ticket",
    bodyHtml: `
      ${heading("New support ticket")}
      ${metaTable(metaRows)}
      ${panel(formatBody(input.message))}
    `,
    footerNote:
      "Reply by email to keep the conversation in this thread. (Replies are not sent back to the user yet, reach them at the From address above.)",
  });

  const lines = [
    `New support ticket`,
    ``,
    `Type:     ${typeLabel(input.type)}`,
    input.platform ? `Platform: ${input.platform}` : null,
    `From:     ${input.userEmail}`,
    `User ID:  ${input.userId}`,
    `Ticket:   ${input.ticketId}`,
    `Created:  ${input.createdAt}`,
    ``,
    `---`,
    input.message,
  ].filter((line): line is string => line !== null);

  return { subject, html, text: lines.join("\n") };
}

function renderNewReply(input: NewReplyInput): Rendered {
  const subject = `[${typeLabel(input.ticketType)}] ${truncate(input.ticketSubjectPreview, 50)}`;

  const metaRows = [
    metaRow("From", escapeHtml(input.replyAuthorEmail)),
    metaRow("User ID", escapeHtml(input.replyAuthorUserId)),
    metaRow("Ticket ID", escapeHtml(input.ticketId)),
    metaRow("Sent", escapeHtml(input.createdAt)),
  ].join("");

  const html = emailLayout({
    preheader: truncate(input.replyBody, 90),
    eyebrow: "Ticket reply",
    bodyHtml: `
      ${heading("New reply on ticket")}
      ${metaTable(metaRows)}
      ${panel(formatBody(input.replyBody))}
    `,
  });

  const text = [
    `New reply on ticket`,
    ``,
    `From:    ${input.replyAuthorEmail}`,
    `User ID: ${input.replyAuthorUserId}`,
    `Ticket:  ${input.ticketId}`,
    `Sent:    ${input.createdAt}`,
    ``,
    `---`,
    input.replyBody,
  ].join("\n");

  return { subject, html, text };
}

type AckInput = {
  ticketId: string;
  type: string;
  message: string;
  createdAt: string;
};

type AdminReplyToUserInput = {
  ticketId: string;
  ticketType: string;
  ticketSubjectPreview: string;
  replyBody: string;
  createdAt: string;
};

// Auto-acknowledgement sent to the ticket author when they file. Friendly,
// no internal metadata (no user id), points them at the web hub.
function renderAck(input: AckInput): Rendered {
  const subject = `We received your support request [${typeLabel(input.type)}]`;

  const html = emailLayout({
    preheader: "We logged your request and the team will follow up here.",
    eyebrow: "Support",
    bodyHtml: `
      ${heading("Thanks, we got your message")}
      ${paragraph(
        `We've logged your ${escapeHtml(typeLabel(input.type).toLowerCase())} and the team will follow up here. You can track and reply to this ticket any time at <a href="${TICKETS_URL}" style="color:${theme.ink};">salelinx.com/account/tickets</a> (it's also in the SaleLinx extension, under Support).`,
        20,
      )}
      ${metaTable(
        [
          metaRow("Type", escapeHtml(typeLabel(input.type))),
          metaRow("Ticket ID", escapeHtml(input.ticketId)),
          metaRow("Received", escapeHtml(input.createdAt)),
        ].join(""),
      )}
      <p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:13px;color:${theme.muted};">Your message:</p>
      ${panel(formatBody(input.message))}
    `,
    footerNote: NO_REPLY_NOTE,
  });

  const text = [
    `Thanks - we got your message`,
    ``,
    `We've logged your ${typeLabel(input.type).toLowerCase()} and the team will follow up here.`,
    `Track and reply: ${TICKETS_URL}`,
    `(also in the SaleLinx extension, under Support)`,
    ``,
    NO_REPLY_NOTE,
    ``,
    `Type:     ${typeLabel(input.type)}`,
    `Ticket:   ${input.ticketId}`,
    `Received: ${input.createdAt}`,
    ``,
    `---`,
    input.message,
  ].join("\n");

  return { subject, html, text };
}

// Admin reply delivered TO the ticket owner. Presented as "SaleLinx Support";
// never reveals the admin's email or user id.
function renderAdminReplyToUser(input: AdminReplyToUserInput): Rendered {
  const subject = `[${typeLabel(input.ticketType)}] ${truncate(input.ticketSubjectPreview, 50)}`;

  const html = emailLayout({
    preheader: truncate(input.replyBody, 90),
    eyebrow: "Support",
    bodyHtml: `
      ${heading("SaleLinx Support replied")}
      ${panel(formatBody(input.replyBody))}
      ${button(TICKETS_URL, "Reply on your ticket")}
    `,
    footerNote: `${NO_REPLY_NOTE} Open it at <a href="${TICKETS_URL}" style="color:${theme.muted};">salelinx.com/account/tickets</a> (Ticket ${escapeHtml(input.ticketId)}). It's also in the SaleLinx extension, under Support.`,
  });

  const text = [
    `SaleLinx Support replied`,
    ``,
    input.replyBody,
    ``,
    `---`,
    NO_REPLY_NOTE,
    `Reply on your ticket: ${TICKETS_URL}`,
    `(also in the SaleLinx extension, under Support)`,
    `Ticket: ${input.ticketId}`,
    `Sent:   ${input.createdAt}`,
  ].join("\n");

  return { subject, html, text };
}

// ============================================================================
// End inlined templates
// ============================================================================

type SupportTicketRow = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  platform: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  notification_message_id: string | null;
};

type SupportTicketReplyRow = {
  id: string;
  ticket_id: string;
  user_id: string;
  body: string;
  is_admin: boolean;
  created_at: string;
};

type DbWebhookPayload =
  | {
      type: "INSERT";
      table: "support_tickets";
      schema: "public";
      record: SupportTicketRow;
      old_record: null;
    }
  | {
      type: "INSERT";
      table: "support_ticket_replies";
      schema: "public";
      record: SupportTicketReplyRow;
      old_record: null;
    };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPPORT_NOTIFY_FROM = Deno.env.get("SUPPORT_NOTIFY_FROM") ?? "";
const SUPPORT_NOTIFY_TO = Deno.env.get("SUPPORT_NOTIFY_TO") ?? "";
const HOOK_SECRET = Deno.env.get("SUPPORT_NOTIFY_HOOK_SECRET") ?? "";
// Replies to user-facing mail have nowhere to go (no inbound handler), so they
// point at an unmonitored address rather than the staffed inbox: a visible
// bounce beats a silent drop. Falls back to the From identity when unset, so a
// missing secret can never route users back to support and recreate the trap.
const SUPPORT_NOTIFY_NOREPLY =
  Deno.env.get("SUPPORT_NOTIFY_NOREPLY") ?? SUPPORT_NOTIFY_FROM;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ResendSendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers?: Record<string, string>;
};

type ResendSendResult = {
  id: string;
  messageId: string | null;
};

// `from` is always SUPPORT_NOTIFY_FROM (the verified Resend identity) so the
// synthesized Message-ID `<{id}@{fromDomain}>` stays stable. The recipient
// varies: staff notifications go to SUPPORT_NOTIFY_TO, while the auto-ack and
// admin-reply-to-user emails go to the relevant user (passed in args.to).
async function sendViaResend(args: ResendSendArgs): Promise<ResendSendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SUPPORT_NOTIFY_FROM,
      to: [args.to],
      reply_to: args.replyTo,
      subject: args.subject,
      html: args.html,
      text: args.text,
      headers: args.headers,
      // Inline masthead logo. Referenced as cid: in the HTML, so it renders
      // without the reader having to allow remote images.
      attachments: EMAIL_ASSETS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { id?: string };
  // Resend doesn't return the SMTP Message-ID directly. Their email id is a
  // uuid; the actual Message-ID header they generate is `<{id}@{from-domain}>`
  // (documented behavior). We synthesize it from the From address domain so
  // threading works on reply notifications.
  const id = json.id ?? "";
  const fromDomain = SUPPORT_NOTIFY_FROM.match(/@([^>\s]+)/)?.[1] ?? "";
  const messageId = id && fromDomain ? `<${id}@${fromDomain}>` : null;
  return { id, messageId };
}

async function fetchUserEmail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) {
    throw new Error(
      `failed to look up auth.users for ${userId}: ${error?.message ?? "no email"}`,
    );
  }
  return data.user.email;
}

async function handleNewTicket(
  supabase: ReturnType<typeof createClient>,
  record: SupportTicketRow,
): Promise<Response> {
  const userEmail = await fetchUserEmail(supabase, record.user_id);

  const { subject, html, text } = renderNewTicket({
    ticketId: record.id,
    type: record.type,
    message: record.message,
    platform: record.platform,
    userId: record.user_id,
    userEmail,
    createdAt: record.created_at,
  });

  const { messageId } = await sendViaResend({
    to: SUPPORT_NOTIFY_TO,
    subject,
    html,
    text,
    replyTo: userEmail,
  });

  if (messageId) {
    const { error } = await supabase
      .from("support_tickets")
      .update({ notification_message_id: messageId })
      .eq("id", record.id);
    if (error) {
      console.error(
        `[send-support-email] failed to persist message-id for ticket ${record.id}: ${error.message}`,
      );
    }
  }

  // Auto-ack to the author. Best-effort: a failure here must NOT fail the
  // webhook after the staff notification + message-id persist already
  // succeeded, so it's wrapped and logged rather than thrown.
  //
  // Skipped for accounts with zero billing history: a throwaway account
  // spamming tickets would otherwise turn every insert into a free outbound
  // Resend email to an address the spammer controls (cost amplification +
  // our domain sending to spam traps). Real customers - trialing, paying,
  // or lapsed - always have a subscriptions row and still get the ack.
  try {
    const { count: subCount } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", record.user_id);
    if ((subCount ?? 0) === 0) {
      console.log(
        `[send-support-email] auto-ack skipped for ticket ${record.id}: no billing history`,
      );
      return jsonResponse(200, { ok: true });
    }
    const ack = renderAck({
      ticketId: record.id,
      type: record.type,
      message: record.message,
      createdAt: record.created_at,
    });
    await sendViaResend({
      to: userEmail,
      subject: ack.subject,
      html: ack.html,
      text: ack.text,
      replyTo: SUPPORT_NOTIFY_NOREPLY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[send-support-email] auto-ack failed for ticket ${record.id}: ${message}`,
    );
  }

  console.log(
    `[send-support-email] new ticket sent ticket=${record.id} type=${record.type}`,
  );
  return jsonResponse(200, { ok: true });
}

async function handleNewReply(
  supabase: ReturnType<typeof createClient>,
  record: SupportTicketReplyRow,
): Promise<Response> {
  // Load the parent ticket up front. We need its user_id to email the OWNER
  // on admin replies (record.user_id is the admin, NOT the owner).
  const { data: ticket, error: ticketErr } = await supabase
    .from("support_tickets")
    .select("id, type, message, user_id, notification_message_id")
    .eq("id", record.ticket_id)
    .single();

  if (ticketErr || !ticket) {
    throw new Error(
      `failed to load parent ticket ${record.ticket_id}: ${ticketErr?.message ?? "not found"}`,
    );
  }

  if (record.is_admin) {
    // Admin reply -> deliver to the ticket OWNER (ticket.user_id), not the
    // admin who authored it. Presented as "SaleLinx Support".
    const ownerEmail = await fetchUserEmail(supabase, ticket.user_id as string);

    const { subject, html, text } = renderAdminReplyToUser({
      ticketId: ticket.id as string,
      ticketType: ticket.type as string,
      ticketSubjectPreview: ticket.message as string,
      replyBody: record.body,
      createdAt: record.created_at,
    });

    // No In-Reply-To/References: notification_message_id is the STAFF thread
    // the owner never received, so threading under it is pointless. The email
    // arrives as a normal message; subject reuse loosely groups it in Gmail.
    await sendViaResend({
      to: ownerEmail,
      subject,
      html,
      text,
      replyTo: SUPPORT_NOTIFY_NOREPLY,
    });

    console.log(
      `[send-support-email] admin reply sent to owner ticket=${ticket.id} reply=${record.id} owner=${ticket.user_id}`,
    );
    return jsonResponse(200, { ok: true });
  }

  // User reply -> notify staff, threaded under the original staff notification.
  const userEmail = await fetchUserEmail(supabase, record.user_id);

  const { subject, html, text } = renderNewReply({
    ticketId: ticket.id as string,
    ticketType: ticket.type as string,
    ticketSubjectPreview: ticket.message as string,
    replyBody: record.body,
    replyAuthorEmail: userEmail,
    replyAuthorUserId: record.user_id,
    createdAt: record.created_at,
  });

  const parentMessageId = ticket.notification_message_id as string | null;
  const headers = parentMessageId
    ? {
        "In-Reply-To": parentMessageId,
        References: parentMessageId,
      }
    : undefined;

  await sendViaResend({
    to: SUPPORT_NOTIFY_TO,
    subject,
    html,
    text,
    replyTo: userEmail,
    headers,
  });

  console.log(
    `[send-support-email] reply sent ticket=${ticket.id} reply=${record.id} threaded=${Boolean(parentMessageId)}`,
  );
  return jsonResponse(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  if (
    !RESEND_API_KEY ||
    !SUPPORT_NOTIFY_FROM ||
    !SUPPORT_NOTIFY_TO ||
    !HOOK_SECRET ||
    !SUPABASE_URL ||
    !SERVICE_ROLE_KEY
  ) {
    console.error("[send-support-email] missing required env");
    return jsonResponse(500, { error: "function misconfigured" });
  }

  const presented = req.headers.get("x-support-webhook-secret") ?? "";
  if (!(await timingSafeEqual(presented, HOOK_SECRET))) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  let payload: DbWebhookPayload;
  try {
    payload = (await req.json()) as DbWebhookPayload;
  } catch (err) {
    console.error("[send-support-email] invalid json:", err);
    return jsonResponse(400, { error: "invalid json" });
  }

  if (payload.type !== "INSERT") {
    return jsonResponse(200, { ok: true, skipped: `type=${payload.type}` });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (payload.table === "support_tickets") {
      return await handleNewTicket(supabase, payload.record);
    }
    if (payload.table === "support_ticket_replies") {
      return await handleNewReply(supabase, payload.record);
    }
    return jsonResponse(200, {
      ok: true,
      skipped: `table=${(payload as { table: string }).table}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-support-email] handler failed:", message);
    return jsonResponse(502, { error: "delivery failed", detail: message });
  }
});
