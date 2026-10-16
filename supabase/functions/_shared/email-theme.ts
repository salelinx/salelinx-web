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
  ebay: "#0968f6", // the eBay blue the site's feature scenes use
} as const;

export const FONT_STACK =
  "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO_STACK =
  "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// The masthead logo, embedded rather than linked.
//
// A remote <img src="https://..."> is blocked by default in most clients, so
// the brand only appeared after the reader clicked "show images", and Outlook
// showed a broken-image box until they did. An inline attachment referenced by
// content id renders without that step.
//
// The bytes live here rather than being read from disk so the function has no
// filesystem or network dependency at send time, and so the logo cannot break
// because a site deploy has not landed yet. Source: public/salelinx-email-logo.png
// (the mark on the masthead cream, RGB, no alpha). Regenerate with:
//   python -c "import base64;print(base64.b64encode(open('public/salelinx-email-logo.png','rb').read()).decode())"
export const LOGO_CID = "salelinx-logo";

// content_type is required in practice, not optional. With only filename and
// content_id set, several clients (Gmail webmail especially) fail to match the
// cid: reference and fall back to listing the file as a download instead of
// painting it in the masthead. Resend's own inline-image guidance says to send
// content_type for exactly this reason.
export const LOGO_ATTACHMENT = {
  filename: "salelinx-logo.png",
  content_type: "image/png",
  content_id: LOGO_CID,
  content:
    "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",
} as const;

// The dot-grid ground tile used to live here, attached by content id and drawn
// via <td background="cid:..."> plus a CSS background-image. It has been removed
// deliberately. Gmail strips CSS background-image and ignores the background
// attribute, so in those clients the tile had no rendered reference at all,
// which left an unreferenced attachment on the message and made the mail arrive
// with a stray file for the reader to download. A flat cream fill via bgcolor
// looks the same in the clients that were dropping the tile anyway. Do not
// reintroduce a background image by content id; only a real <img> reference is
// reliably treated as inline. Tile source, if ever needed: public/email-dot-tile.png

/** Every inline asset the layout references. Pass to Resend's attachments. */
export const EMAIL_ASSETS = [LOGO_ATTACHMENT];

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
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;">
    <tr>
      <td style="border-radius:999px;background:${theme.button};">
        <a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:${theme.buttonInk};text-decoration:none;border-radius:999px;">${label} &nbsp;&rarr;</a>
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
  return `<h1 style="margin:0 0 12px;font-family:${FONT_STACK};font-size:29px;line-height:1.15;font-weight:600;letter-spacing:-0.035em;color:${theme.ink};">${text}</h1>`;
}

export function paragraph(text: string, marginBottom = 24): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${FONT_STACK};font-size:15.5px;line-height:1.65;color:${theme.inkSoft};">${text}</p>`;
}

/** Inset panel for quoted content: a ticket body, a message, a summary. */
export function panel(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:${theme.page};border:1px solid ${theme.hairline};border-radius:12px;">
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
 * The shell every email shares.
 *
 * Deliberately NOT the centred-white-card-on-a-tint pattern. That is the
 * default shape every transactional email uses, so a SaleLinx email built that
 * way reads as a lightly reskinned template no matter what the colours are.
 * This is built from the things that are actually ours:
 *
 *   - the dot-grid cream ground from the site background
 *   - a left-aligned masthead and headline, not centred
 *   - the Depop/Vinted/eBay split rule, which no other product can use
 *   - the mono uppercase eyebrow in an outlined pill, as on the homepage
 *   - the zinc-900 pill CTA, matching the site's primary button
 *
 * Everything is tables and inline styles, and both images are inline
 * attachments, so the identity survives Outlook and blocked remote content.
 */
export function emailLayout(input: LayoutInput): string {
  const { preheader, eyebrow, bodyHtml, footerNote } = input;
  const siteUrl = input.siteUrl || "https://www.salelinx.com";

  const eyebrowHtml = eyebrow
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
         <tr><td style="border:1px solid ${theme.hairline};border-radius:999px;padding:6px 13px;background:${theme.card};font-family:${MONO_STACK};font-size:10.5px;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:${theme.muted};">${eyebrow}</td></tr>
       </table>`
    : "";

  const footerNoteHtml = footerNote
    ? `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;color:${theme.muted};">${footerNote}</p>`
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
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.page};">
      <tr>
        <td bgcolor="${theme.page}" style="background-color:${theme.page};padding:44px 16px;">
          <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

            <tr>
              <td style="padding:0 0 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <a href="${siteUrl}" style="text-decoration:none;color:${theme.ink};">
                        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                          <td style="padding:0 9px 0 0;vertical-align:middle;">
                            <img src="cid:${LOGO_CID}" width="20" height="28" alt="" style="display:block;width:20px;height:28px;border:0;outline:none;" />
                          </td>
                          <td style="vertical-align:middle;font-family:${FONT_STACK};font-size:18px;font-weight:600;letter-spacing:-0.025em;color:${theme.ink};">SaleLinx</td>
                        </tr></table>
                      </a>
                    </td>
                    <td align="right" style="vertical-align:middle;font-family:${MONO_STACK};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${theme.faint};">
                      Depop &nbsp;+&nbsp; Vinted &nbsp;+&nbsp; eBay
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:${theme.card};border:1px solid ${theme.hairline};border-radius:18px;padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="3" style="font-size:0;line-height:0;height:3px;background:${theme.depop};border-top-left-radius:18px;">&nbsp;</td>
                    <td height="3" style="font-size:0;line-height:0;height:3px;background:${theme.vinted};">&nbsp;</td>
                    <td height="3" style="font-size:0;line-height:0;height:3px;background:${theme.ebay};border-top-right-radius:18px;">&nbsp;</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:34px 38px 38px;">
                    ${eyebrowHtml}
                    ${bodyHtml}
                  </td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:26px 2px 0;">
                ${footerNoteHtml}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
                  <tr>
                    <td style="padding:0 7px 0 0;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${theme.depop};"></span></td>
                    <td style="padding:0 14px 0 0;font-family:${FONT_STACK};font-size:12px;color:${theme.muted};">Depop</td>
                    <td style="padding:0 7px 0 0;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${theme.vinted};"></span></td>
                    <td style="padding:0 14px 0 0;font-family:${FONT_STACK};font-size:12px;color:${theme.muted};">Vinted</td>
                    <td style="padding:0 7px 0 0;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${theme.ebay};"></span></td>
                    <td style="font-family:${FONT_STACK};font-size:12px;color:${theme.muted};">eBay</td>
                  </tr>
                </table>
                <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.65;color:${theme.faint};">
                  Run all your shops from one panel.<br />
                  <a href="${siteUrl}" style="color:${theme.muted};text-decoration:none;">salelinx.com</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}
