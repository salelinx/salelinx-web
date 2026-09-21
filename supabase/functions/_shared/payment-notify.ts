// Staff notification for anything money-related.
//
// Deliberately fire-and-forget. A notification is not worth failing a webhook
// for: the handler returning 500 makes Stripe redeliver the event, and a
// redelivered event is a second chance to get the subscription state wrong.
// Every path here swallows its own errors and logs instead.
//
// Body text is plain and short on purpose. This lands on a phone, and the
// useful version answers "who, what tier, how much" without being opened.

interface NotifyInput {
  /** Headline, e.g. "New trial" or "Payment failed". */
  event: string;
  /** Who it concerns. Omitted when we cannot resolve them. */
  email?: string | null;
  tier?: string | null;
  status?: string | null;
  /** Minor units, as Stripe reports them. */
  amount?: number | null;
  currency?: string | null;
  /** Anything else worth a line, e.g. "card declined". */
  note?: string | null;
}

const money = (amount?: number | null, currency?: string | null): string | null => {
  if (amount === null || amount === undefined) return null;
  const symbol = { gbp: "£", usd: "$", eur: "€" }[(currency ?? "").toLowerCase()] ?? "";
  return `${symbol}${(amount / 100).toFixed(2)}${symbol ? "" : ` ${(currency ?? "").toUpperCase()}`}`;
};

export async function notifyPayment(input: NotifyInput): Promise<void> {
  const to = Deno.env.get("PAYMENT_NOTIFY_TO") ?? Deno.env.get("SUPPORT_NOTIFY_TO");
  const from = Deno.env.get("SUPPORT_NOTIFY_FROM") ?? Deno.env.get("RESEND_FROM");
  const key = Deno.env.get("RESEND_API_KEY");

  // Unconfigured is not an error. The webhook's job is the subscription row;
  // this is a courtesy on top of it.
  if (!to || !from || !key) return;

  const lines = [
    input.email ? `Who:    ${input.email}` : null,
    input.tier ? `Tier:   ${input.tier}${input.status ? ` (${input.status})` : ""}` : null,
    money(input.amount, input.currency) ? `Amount: ${money(input.amount, input.currency)}` : null,
    input.note ? `Note:   ${input.note}` : null,
  ].filter(Boolean);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `[SaleLinx] ${input.event}${input.email ? ` - ${input.email}` : ""}`,
        text: `${input.event}\n\n${lines.join("\n")}\n`,
      }),
    });
    if (!res.ok) {
      console.error(`[notify] Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[notify] send failed:", (err as Error).message);
  }
}
