"use client";

// The "send us a message" form (creates a support_tickets row). Extracted from
// the former SupportClient so it can live on the login-gated /help/support
// contact page, separate from the ticket-tracking list on /account/tickets.
// The insert + RLS (user creates own row, source web/extension) is unchanged.

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { TicketType } from "@/lib/types/support";

const TICKET_TYPES: TicketType[] = ["bug", "feature", "feedback", "other"];

type Props = {
  userId: string;
};

export function NewTicketForm({ userId }: Props) {
  const t = useTranslations("Support");
  const locale = useLocale();
  const supabase = createBrowserClient();

  // Empty default: the user must pick a type. "" renders the placeholder option.
  const [type, setType] = useState<TicketType | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  async function submitTicket() {
    const text = message.trim();
    if (!text || !type) return;

    setSubmitting(true);
    setFormStatus("idle");

    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId,
      type,
      message: text,
      platform: null,
      source: "web",
      locale,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    setSubmitting(false);

    if (error) {
      setFormStatus("error");
      return;
    }

    setFormStatus("success");
    setMessage("");
    setType("");
  }

  return (
    <section className="mt-10 rounded-2xl border border-black/10 p-6 dark:border-white/10">
      <h2 className="text-xl font-semibold">{t("newTicketTitle")}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {t("newTicketBody")}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="ticket-type">
            {t("typeLabel")}
          </label>
          <select
            id="ticket-type"
            value={type}
            onChange={(e) => setType(e.target.value as TicketType | "")}
            className="mt-1.5 w-full max-w-xs rounded-lg border border-black/10 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-transparent"
          >
            {/* Options render in a native OS popup (always light), so give them
                explicit dark-on-white colors; without this they inherit the
                page's light text and are unreadable on the white menu. */}
            <option value="" disabled className="bg-white text-zinc-500">
              {t("typePlaceholder")}
            </option>
            {TICKET_TYPES.map((tt) => (
              <option key={tt} value={tt} className="bg-white text-zinc-900">
                {t(`type_${tt}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="ticket-message">
            {t("messageLabel")}
          </label>
          <textarea
            id="ticket-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (formStatus !== "idle") setFormStatus("idle");
            }}
            rows={5}
            placeholder={t("messagePlaceholder")}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm dark:border-white/20 dark:bg-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submitTicket}
            disabled={submitting || !message.trim() || !type}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
          {formStatus === "error" && (
            <span className="text-sm text-red-600">{t("submitError")}</span>
          )}
        </div>

        {formStatus === "success" && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/60 p-4 text-sm dark:border-emerald-400/20 dark:bg-emerald-950/20">
            <p className="text-emerald-700 dark:text-emerald-300">
              {t("submitSuccess")}
            </p>
            <Link
              href="/account/tickets"
              className="mt-1 inline-block underline underline-offset-4"
            >
              {t("trackTicketsCta")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
