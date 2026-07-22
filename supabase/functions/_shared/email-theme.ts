// Shared visual language for every transactional email we send, so auth,
// support and shipping-label mail all look like the same product.
//
// Tokens mirror app/globals.css and the homepage components: warm cream page,
// white card, near-black pill buttons, monospace uppercase eyebrow labels.
//
// Email HTML is not web HTML. Rules that shape everything below:
//   - Tables for layout. No flexbox, no grid, no CSS custom properties.
//   - Inline styles only. Gmail strips <style> blocks in many contexts.
//   - Solid hex only. rgba() borders render inconsistently, so the hairline
//     is pre-blended against the cream background rather than left translucent.
//   - Web fonts do not load. Geist is listed first for clients that happen to
//     have it, then a system stack that keeps the same geometric-neutral feel.
//   - color-scheme is pinned to light. Left unset, Gmail and Outlook invert
//     colours on their own and produce muddy, off-brand results.

export const theme = {
  page: "#faf8f3", // --background
  band: "#efece3", // --background-band
  card: "#ffffff",
  hairline: "#e6e3da", // black/8 pre-blended onto the cream page
  panelBg: "#faf9f6",
  ink: "#171717", // --foreground
  inkSoft: "#3f3f46",
  muted: "#71717a",
  faint: "#a1a1aa",
  button: "#18181b", // zinc-900, matches the homepage primary CTA
  buttonInk: "#ffffff",
  accent: "#059669", // emerald, the site's "live" signal
  depop: "#ff2300",
  vinted: "#007782",
} as const;

export const FONT_STACK =
  "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO_STACK =
  "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Primary call to action. Pill shape and near-black fill, as on the site. */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
    <tr>
      <td style="border-radius:999px;background:${theme.button};">
        <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:${theme.buttonInk};text-decoration:none;border-radius:999px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Copy-the-URL fallback, for clients that mangle or strip the button. */
export function linkFallback(url: string, prefix: string): string {
  return `<p style="margin:20px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${theme.muted};">
    ${prefix}<br />
    <a href="${url}" style="color:${theme.inkSoft};word-break:break-all;">${url}</a>
  </p>`;
}

/** Heading + supporting paragraph, the opening of nearly every email. */
export function heading(text: string): string {
  return `<h1 style="margin:0 0 10px;font-family:${FONT_STACK};font-size:23px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${theme.ink};">${text}</h1>`;
}

export function paragraph(text: string, marginBottom = 24): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${theme.inkSoft};">${text}</p>`;
}

/** Inset panel for quoted content: a ticket body, a message, a summary. */
export function panel(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:${theme.panelBg};border:1px solid ${theme.hairline};border-radius:12px;">
    <tr><td style="padding:16px 18px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${theme.inkSoft};">${innerHtml}</td></tr>
  </table>`;
}

/** One label/value line in a metadata block. */
export function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:5px 20px 5px 0;font-family:${FONT_STACK};font-size:13px;color:${theme.muted};vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:5px 0;font-family:${FONT_STACK};font-size:13px;color:${theme.ink};font-weight:500;word-break:break-word;">${value}</td>
  </tr>`;
}

export function metaTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">${rows}</table>`;
}

/** Large tracked numeric code, for reauthentication. */
export function codeBlock(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:${theme.band};border:1px solid ${theme.hairline};border-radius:12px;">
    <tr><td align="center" style="padding:20px;font-family:${MONO_STACK};font-size:30px;font-weight:600;letter-spacing:0.28em;color:${theme.ink};">${code}</td></tr>
  </table>`;
}

type LayoutInput = {
  /** Inbox preview line. Without it, clients scrape the first body text. */
  preheader: string;
  /** Small uppercase mono label above the heading, mirrors the site's pills. */
  eyebrow?: string;
  bodyHtml: string;
  /** Small print under the divider. */
  footerNote?: string;
  siteUrl?: string;
};

/**
 * The shell every email shares: cream page, centred white card, logo lockup,
 * optional eyebrow, body, footer.
 *
 * The masthead mirrors the site header exactly: the logo mark next to the
 * "SaleLinx" wordmark. Both are present on purpose. Many clients block remote
 * images until the reader allows them, and the text half means the brand still
 * reads when that happens, so the mark is decorative (alt="") rather than
 * carrying the name on its own.
 */
export function emailLayout(input: LayoutInput): string {
  const { preheader, eyebrow, bodyHtml, footerNote } = input;
  const siteUrl = input.siteUrl || "https://www.salelinx.com";
  // Absolute URL: email clients have no origin to resolve a relative path from.
  const logoUrl = `${siteUrl.replace(/\/$/, "")}/salelinx-logo.png`;

  const eyebrowHtml = eyebrow
    ? `<div style="margin:0 0 14px;font-family:${MONO_STACK};font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${theme.muted};">${eyebrow}</div>`
    : "";

  const footerNoteHtml = footerNote
    ? `<p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${theme.muted};">${footerNote}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>SaleLinx</title>
  </head>
  <body style="margin:0;padding:0;background:${theme.page};color:${theme.ink};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.page};padding:40px 16px;">
      <tr>
        <td align="center">

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:0 4px 18px;">
                <a href="${siteUrl}" style="text-decoration:none;color:${theme.ink};">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="padding:0 9px 0 0;vertical-align:middle;">
                      <img src="${logoUrl}" width="20" height="28" alt="" style="display:block;width:20px;height:28px;border:0;outline:none;text-decoration:none;" />
                    </td>
                    <td style="vertical-align:middle;font-family:${FONT_STACK};font-size:17px;font-weight:600;letter-spacing:-0.02em;color:${theme.ink};">SaleLinx</td>
                  </tr></table>
                </a>
              </td>
            </tr>
          </table>

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${theme.card};border:1px solid ${theme.hairline};border-radius:16px;">
            <tr>
              <td style="padding:34px 36px;">
                ${eyebrowHtml}
                ${bodyHtml}
              </td>
            </tr>
          </table>

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:22px 4px 0;">
                ${footerNoteHtml}
                <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${theme.faint};">
                  SaleLinx, sell on <span style="color:${theme.depop};">Depop</span> and <span style="color:${theme.vinted};">Vinted</span> from one place.<br />
                  <a href="${siteUrl}" style="color:${theme.muted};text-decoration:none;">salelinx.com</a>
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}
