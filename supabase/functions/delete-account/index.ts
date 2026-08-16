// deno-lint-ignore-file
// delete-account: self-serve account deletion from the account page
// (/account Danger zone), with an email confirmation step in the middle so a
// hijacked session cannot erase an account on its own. Two stages, both
// requiring a valid session:
//
//   { stage: "request", locale? }
//     Emails the account address a confirmation link (Resend, shared email
//     theme). The link carries an HMAC-signed token (user id + expiry, 60
//     minutes, DELETE_ACCOUNT_TOKEN_SECRET) and points at
//     {SITE_URL}/{locale}/account/delete-confirm?token=...
//
//   { stage: "confirm", token }
//     Verifies the token (signature, expiry, and that it was minted for the
//     CALLER), then runs the same GDPR erasure steps as admin-delete-user
//     (scripts/delete-user-account.mjs, docs/GDPR.md):
//       1. Storage objects under listing-images/{userId}/ (DB cascade does
//          not touch Storage)
//       2. The Stripe customer(s) - deletion cancels any active subscription;
//          Stripe retains invoices for tax law, which the policy discloses
//       3. The auth.users row - ON DELETE CASCADE then removes every
//          user-owned row (listings, credentials, settings, linked accounts,
//          subscriptions, usage, storage, tickets, replies, referrals)
//
// The token is stateless (no table): replay within the window is harmless
// because the account is already gone, and deletion is the only thing the
// token can do, for its own subject only.
//
// Unlike admin-delete-user there is NO admin_audit_log entry: actor_id is a
// NOT NULL FK to auth.users, so a self-deleting user cannot be the actor of
// a row that outlives them, and a self-delete is not an admin action anyway.
// Counts are logged (no PII; user UUIDs are the ceiling, see docs/GDPR.md).
//
// Guard: admins cannot self-delete here (their admin_audit_log entries hold
// a plain FK to auth.users, so the delete would fail mid-runbook; revoke
// admin first, then use the admin console or the script).
//
// Auth: verify_jwt = false at the gateway (ES256, same as the other authed
// functions); the handler validates the caller via getUser(). The UI adds a
// client-side password recheck before the request stage, same pattern as the
// admin console's step-up reauth.

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  button,
  EMAIL_ASSETS,
  emailLayout,
  heading,
  linkFallback,
  paragraph,
} from "../_shared/email-theme.ts";
import {
  corsHeaders as sharedCorsHeaders,
  timingSafeEqual,
} from "../_shared/security.ts";

const BUCKET = "listing-images";
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
// Each request sends an email to the account owner; cap it so a hijacked
// session cannot bomb their inbox.
const DAILY_REQUEST_CAP = 5;

const corsHeaders = sharedCorsHeaders();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Signed one-time-ish token: base64url(userId).exp.base64url(hmac(userId.exp))
// ---------------------------------------------------------------------------

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("DELETE_ACCOUNT_TOKEN_SECRET");
  if (!secret) throw new Error("DELETE_ACCOUNT_TOKEN_SECRET not set");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  const key = await hmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `${userId}.${exp}.${b64url(new Uint8Array(sig))}`;
}

/** Returns the token's user id if valid and unexpired, else null. */
async function verifyToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  const key = await hmacKey();
  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}.${exp}`),
  );
  if (!(await timingSafeEqual(b64url(new Uint8Array(expected)), sig))) {
    return null;
  }
  return userId;
}

// ---------------------------------------------------------------------------
// Confirmation email (matches messages/*.json locales; en fallback)
// ---------------------------------------------------------------------------

type Locale = "en" | "fr" | "es" | "de";
const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "fr", "es", "de"];

const EMAIL_COPY: Record<
  Locale,
  {
    subject: string;
    preheader: string;
    eyebrow: string;
    heading: string;
    body: string;
    cta: string;
    expiry: string;
    ignore: string;
    fallback: string;
  }
> = {
  en: {
    subject: "Confirm the deletion of your SaleLinx account",
    preheader: "One more step before your account is permanently deleted.",
    eyebrow: "Account deletion",
    heading: "Confirm account deletion",
    body: "You asked us to delete your SaleLinx account. This will permanently remove your listings, images, linked marketplace accounts, usage history, and support tickets, and cancel any active subscription. To continue, open the confirmation page below.",
    cta: "Review and confirm",
    expiry: "This link expires in 60 minutes and only works while you are signed in to the account it was requested for.",
    ignore:
      "If you did not request this, no action is needed and nothing will be deleted, but we recommend reviewing your account security: change your password, or check your Google account if you sign in with Google.",
    fallback: "Or copy this link into your browser:",
  },
  fr: {
    subject: "Confirmez la suppression de votre compte SaleLinx",
    preheader: "Encore une étape avant la suppression définitive de votre compte.",
    eyebrow: "Suppression du compte",
    heading: "Confirmer la suppression du compte",
    body: "Vous avez demandé la suppression de votre compte SaleLinx. Cela supprimera définitivement vos annonces, images, comptes de places de marché liés, historique d'utilisation et tickets d'assistance, et annulera tout abonnement actif. Pour continuer, ouvrez la page de confirmation ci-dessous.",
    cta: "Vérifier et confirmer",
    expiry:
      "Ce lien expire dans 60 minutes et ne fonctionne que si vous êtes connecté au compte concerné.",
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, aucune action n'est nécessaire et rien ne sera supprimé, mais nous vous recommandons de vérifier la sécurité de votre compte : changez votre mot de passe, ou vérifiez votre compte Google si vous vous connectez avec Google.",
    fallback: "Ou copiez ce lien dans votre navigateur :",
  },
  es: {
    subject: "Confirma la eliminación de tu cuenta de SaleLinx",
    preheader: "Un paso más antes de que tu cuenta se elimine permanentemente.",
    eyebrow: "Eliminación de cuenta",
    heading: "Confirmar la eliminación de la cuenta",
    body: "Has pedido que eliminemos tu cuenta de SaleLinx. Esto eliminará permanentemente tus publicaciones, imágenes, cuentas de marketplaces vinculadas, historial de uso y tickets de soporte, y cancelará cualquier suscripción activa. Para continuar, abre la página de confirmación de abajo.",
    cta: "Revisar y confirmar",
    expiry:
      "Este enlace caduca en 60 minutos y solo funciona con la sesión iniciada en la cuenta para la que se solicitó.",
    ignore:
      "Si no solicitaste esto, no hace falta hacer nada y no se eliminará nada, pero te recomendamos revisar la seguridad de tu cuenta: cambia tu contraseña o revisa tu cuenta de Google si inicias sesión con Google.",
    fallback: "O copia este enlace en tu navegador:",
  },
  de: {
    subject: "Bestätige die Löschung deines SaleLinx-Kontos",
    preheader: "Noch ein Schritt, bevor dein Konto endgültig gelöscht wird.",
    eyebrow: "Kontolöschung",
    heading: "Kontolöschung bestätigen",
    body: "Du hast die Löschung deines SaleLinx-Kontos angefordert. Dabei werden deine Angebote, Bilder, verknüpften Marktplatz-Konten, dein Nutzungsverlauf und deine Support-Tickets dauerhaft gelöscht und ein aktives Abo gekündigt. Öffne zum Fortfahren die Bestätigungsseite unten.",
    cta: "Prüfen und bestätigen",
    expiry:
      "Dieser Link läuft in 60 Minuten ab und funktioniert nur, solange du im betreffenden Konto angemeldet bist.",
    ignore:
      "Falls du das nicht angefordert hast, musst du nichts tun und es wird nichts gelöscht. Wir empfehlen dir aber, die Sicherheit deines Kontos zu prüfen: Ändere dein Passwort oder prüfe dein Google-Konto, falls du dich mit Google anmeldest.",
    fallback: "Oder kopiere diesen Link in deinen Browser:",
  },
};

async function sendConfirmationEmail(args: {
  to: string;
  confirmUrl: string;
  locale: Locale;
}): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) throw new Error("resend env not set");

  const c = EMAIL_COPY[args.locale];
  const html = emailLayout({
    preheader: c.preheader,
    eyebrow: c.eyebrow,
    bodyHtml: [
      heading(c.heading),
      paragraph(c.body),
      button(args.confirmUrl, c.cta),
      linkFallback(args.confirmUrl, c.fallback),
      paragraph(`${c.expiry} ${c.ignore}`, 0),
    ].join("\n"),
    footerNote: c.expiry,
  });
  const text = `${c.heading}\n\n${c.body}\n\n${c.cta}: ${args.confirmUrl}\n\n${c.expiry}\n${c.ignore}\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: c.subject,
      html,
      text,
      attachments: EMAIL_ASSETS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const userId = user.id;

  let body: { stage?: string; locale?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "missing_params" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Both stages refuse admins: request for early UX, confirm for enforcement.
  const { data: adminRow, error: adminErr } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminErr) return json({ error: "admin_check_failed" }, 500);
  if (adminRow) return json({ error: "admin_account" }, 400);

  // -------------------------------------------------------------------------
  // Stage 1: email the confirmation link
  // -------------------------------------------------------------------------
  if (body.stage === "request") {
    if (!user.email) return json({ error: "no_email" }, 400);

    // Rate limit: the counter RPC is auth.uid()-scoped, so counting through
    // the user's own client charges the right user and needs no new table.
    const dayKey = new Date().toISOString().slice(0, 10);
    const { data: reqCount, error: rlErr } = await authClient.rpc(
      "increment_usage_counter",
      { p_feature: "delete_account_requests", p_period_key: dayKey },
    );
    if (rlErr) {
      console.error(`[delete-account] rate-limit counter failed:`, rlErr.message);
      return json({ error: "rate_limit_check_failed" }, 500);
    }
    if (typeof reqCount === "number" && reqCount > DAILY_REQUEST_CAP) {
      console.log(`[delete-account] request cap reached user=${userId}`);
      return json({ error: "rate_limited" }, 429);
    }

    const locale: Locale = SUPPORTED_LOCALES.includes(body.locale as Locale)
      ? (body.locale as Locale)
      : "en";
    const siteUrl = (Deno.env.get("SITE_URL") ?? "https://www.salelinx.com")
      .replace(/\/$/, "");
    const token = await signToken(userId);
    const confirmUrl = `${siteUrl}/${locale}/account/delete-confirm?token=${encodeURIComponent(token)}`;

    try {
      await sendConfirmationEmail({ to: user.email, confirmUrl, locale });
    } catch (err) {
      console.error(`[delete-account] email failed for user=${userId}:`, err);
      return json({ error: "email_failed" }, 502);
    }

    console.log(`[delete-account] confirmation email sent user=${userId}`);
    return json({ ok: true, sent: true });
  }

  // -------------------------------------------------------------------------
  // Stage 2: verify the token, then run the erasure
  // -------------------------------------------------------------------------
  if (body.stage !== "confirm") return json({ error: "missing_params" }, 400);
  if (typeof body.token !== "string" || !body.token) {
    return json({ error: "invalid_token" }, 400);
  }
  const tokenUserId = await verifyToken(body.token);
  if (!tokenUserId || tokenUserId !== userId) {
    return json({ error: "invalid_token" }, 400);
  }

  // 1. Storage objects (mirrors admin-delete-user: the usual layout is
  // {userId}/{listingId}/{file}, with a fallback for files directly under the
  // user folder). DB cascade does not touch Storage.
  const paths: string[] = [];
  const { data: folders, error: listErr } = await admin.storage
    .from(BUCKET)
    .list(userId, { limit: 1000 });
  if (listErr) return json({ error: `storage list: ${listErr.message}` }, 500);
  for (const entry of folders ?? []) {
    if (entry.id) {
      paths.push(`${userId}/${entry.name}`);
      continue;
    }
    const { data: files, error: fileErr } = await admin.storage
      .from(BUCKET)
      .list(`${userId}/${entry.name}`, { limit: 1000 });
    if (fileErr)
      return json({ error: `storage list: ${fileErr.message}` }, 500);
    for (const f of files ?? []) paths.push(`${userId}/${entry.name}/${f.name}`);
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmErr } = await admin.storage
      .from(BUCKET)
      .remove(paths.slice(i, i + 100));
    if (rmErr) return json({ error: `storage remove: ${rmErr.message}` }, 500);
  }

  // 2. Stripe customers. Deleting a customer cancels its subscriptions;
  // invoices survive (retained for tax law). A user can in principle have
  // rows pointing at more than one customer id, so delete each distinct one.
  const { data: subs } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId);
  const customerIds = Array.from(
    new Set(
      (subs ?? [])
        .map((s) => s.stripe_customer_id as string | null)
        .filter((id): id is string => !!id),
    ),
  );
  let stripeDeleted = 0;
  if (customerIds.length > 0) {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-02-24.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });
    for (const id of customerIds) {
      try {
        await stripe.customers.del(id);
        stripeDeleted += 1;
      } catch (err) {
        // Already-deleted customers are fine; anything else must abort so we
        // never delete the account while Stripe could still charge them.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("No such customer")) {
          return json({ error: `stripe: ${msg}` }, 500);
        }
      }
    }
  }

  // 3. The auth user - cascades every user-owned row.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json({ error: `deleteUser: ${delErr.message}` }, 500);

  console.log(
    `[delete-account] self-delete complete: ${paths.length} storage objects, ${stripeDeleted} stripe customers`,
  );

  return json({
    ok: true,
    storage_objects: paths.length,
    stripe_customers: stripeDeleted,
  });
});
