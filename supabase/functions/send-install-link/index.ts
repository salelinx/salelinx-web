// deno-lint-ignore-file
// send-install-link: emails the caller's own address the Chrome Web Store
// link, for people who sign up on a phone and cannot install the extension
// there (/get-started calls it). A service email the user asked for, so it is
// not gated on the marketing choice.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  button,
  COMPANY_INFO,
  EMAIL_ASSETS,
  emailLayout,
  heading,
  linkFallback,
  paragraph,
} from "../_shared/email-theme.ts";
import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";

// Mirrors CHROME_WEB_STORE_URL in lib/site.ts, which Deno cannot import.
const STORE_URL =
  "https://chromewebstore.google.com/detail/salelinx/oichfmfogobecihmhlgkfcfbdceomenj";
const DAILY_CAP = 3;

const corsHeaders = sharedCorsHeaders();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Locale = "en" | "fr" | "es" | "de";
const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "fr", "es", "de"];

const EMAIL_COPY: Record<
  Locale,
  { subject: string; preheader: string; heading: string; body: string; cta: string; fallback: string }
> = {
  en: {
    subject: "Your SaleLinx install link",
    preheader: "Open this on your computer to add SaleLinx to Chrome.",
    heading: "Add SaleLinx to Chrome",
    body: "SaleLinx is a Chrome extension, so it installs on a computer rather than a phone. Open this email on your computer, add SaleLinx to Chrome, then sign in with the account you just created.",
    cta: "Add to Chrome",
    fallback: "Or copy this link into Chrome on your computer:",
  },
  fr: {
    subject: "Votre lien d'installation SaleLinx",
    preheader: "Ouvrez ceci sur votre ordinateur pour ajouter SaleLinx à Chrome.",
    heading: "Ajouter SaleLinx à Chrome",
    body: "SaleLinx est une extension Chrome : elle s'installe sur un ordinateur, pas sur un téléphone. Ouvrez cet e-mail sur votre ordinateur, ajoutez SaleLinx à Chrome, puis connectez-vous avec le compte que vous venez de créer.",
    cta: "Ajouter à Chrome",
    fallback: "Ou copiez ce lien dans Chrome sur votre ordinateur :",
  },
  es: {
    subject: "Tu enlace para instalar SaleLinx",
    preheader: "Ábrelo en tu ordenador para añadir SaleLinx a Chrome.",
    heading: "Añade SaleLinx a Chrome",
    body: "SaleLinx es una extensión de Chrome, así que se instala en un ordenador, no en el móvil. Abre este correo en tu ordenador, añade SaleLinx a Chrome e inicia sesión con la cuenta que acabas de crear.",
    cta: "Añadir a Chrome",
    fallback: "O copia este enlace en Chrome en tu ordenador:",
  },
  de: {
    subject: "Dein SaleLinx-Installationslink",
    preheader: "Öffne das auf deinem Computer, um SaleLinx zu Chrome hinzuzufügen.",
    heading: "SaleLinx zu Chrome hinzufügen",
    body: "SaleLinx ist eine Chrome-Erweiterung und wird auf einem Computer installiert, nicht auf dem Handy. Öffne diese E-Mail auf deinem Computer, füge SaleLinx zu Chrome hinzu und melde dich mit dem Konto an, das du gerade erstellt hast.",
    cta: "Zu Chrome hinzufügen",
    fallback: "Oder kopiere diesen Link in Chrome auf deinem Computer:",
  },
};

async function sendEmail(to: string, locale: Locale): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) throw new Error("resend env not set");

  const c = EMAIL_COPY[locale];
  const html = emailLayout({
    preheader: c.preheader,
    eyebrow: "SaleLinx",
    bodyHtml: [
      heading(c.heading),
      paragraph(c.body),
      button(STORE_URL, c.cta),
      linkFallback(STORE_URL, c.fallback),
    ].join("\n"),
  });
  const text = `${c.heading}\n\n${c.body}\n\n${c.cta}: ${STORE_URL}\n\n${COMPANY_INFO}\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: c.subject, html, text, attachments: EMAIL_ASSETS }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!user.email) return json({ error: "no_email" }, 400);

  const { data: count, error: rlErr } = await authClient.rpc("increment_usage_counter", {
    p_feature: "install_link_emails",
    p_period_key: new Date().toISOString().slice(0, 10),
  });
  if (rlErr) {
    console.error("[send-install-link] rate-limit counter failed:", rlErr.message);
    return json({ error: "rate_limit_check_failed" }, 500);
  }
  if (typeof count === "number" && count > DAILY_CAP) return json({ error: "rate_limited" }, 429);

  let locale: Locale = "en";
  try {
    const body = await req.json();
    if (SUPPORTED_LOCALES.includes(body?.locale)) locale = body.locale;
  } catch {
    // no body: English
  }

  try {
    await sendEmail(user.email, locale);
  } catch (err) {
    console.error(`[send-install-link] email failed for user=${user.id}:`, err);
    return json({ error: "email_failed" }, 502);
  }
  console.log(`[send-install-link] sent user=${user.id}`);
  return json({ ok: true });
});
