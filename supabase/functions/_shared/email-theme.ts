// Shared visual language for every transactional email we send, so auth,
// support and shipping-label mail all look like the same product.
//
// White page and card, near-black pill buttons, monospace uppercase eyebrow labels.
//
// Email HTML is not web HTML. Rules that shape everything below:
//   - Tables for layout. No flexbox, no grid, no CSS custom properties.
//   - Inline styles only. Gmail strips <style> blocks in many contexts.
//   - Solid hex only. rgba() borders render inconsistently, so the hairline
//     is pre-blended against white rather than left translucent.
//   - Web fonts do not load. Geist is listed first for clients that happen to
//     have it, then a system stack that keeps the same geometric-neutral feel.
//   - color-scheme is pinned to light. Left unset, Gmail and Outlook invert
//     colours on their own and produce muddy, off-brand results.

export const theme = {
  page: "#ffffff",
  band: "#f4f4f5",
  card: "#ffffff",
  hairline: "#ebebeb", // black/8 pre-blended onto white
  panelBg: "#fafafa",
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
// (the mark on white, RGB, no alpha). Regenerate with:
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
// with a stray file for the reader to download. Do not
// reintroduce a background image by content id; only a real <img> reference is
// reliably treated as inline. Tile source, if ever needed: public/email-dot-tile.png

/** Every inline asset the layout references. Pass to Resend's attachments. */
export const EMAIL_ASSETS = [LOGO_ATTACHMENT];

// Source: public/email-chrome-logo.png, the site's ChromeLogo SVG at 3x. Gmail does not render SVG.
export const CHROME_LOGO_CID = "chrome-logo";
export const CHROME_LOGO_ATTACHMENT = {
  filename: "chrome-logo.png",
  content_type: "image/png",
  content_id: CHROME_LOGO_CID,
  content:
    "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",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Primary call to action. Pill shape and near-black fill, as on the site. */
export function button(href: string, label: string, iconCid?: string): string {
  const icon = iconCid
    ? `<img src="cid:${iconCid}" width="18" height="18" alt="" style="display:inline-block;width:18px;height:18px;border:0;vertical-align:-4px;margin-right:10px;" />`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;">
    <tr>
      <td style="border-radius:999px;background:${theme.button};">
        <a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:1;color:${theme.buttonInk};text-decoration:none;border-radius:999px;">${icon}${label} &nbsp;&rarr;</a>
      </td>
    </tr>
  </table>`;
}

/** Copy-the-URL fallback, for clients that mangle or strip the button. */
export function linkFallback(url: string, prefix: string): string {
  return `<p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${theme.faint};">
    ${prefix}<br />
    <a href="${url}" style="color:${theme.muted};text-decoration:none;word-break:break-all;">${url}</a>
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

/**
 * Companies Act 2006 disclosure: business emails must state the registered
 * name, number, place of registration and registered office. Rendered in the
 * shared footer so every outgoing email carries it; exported for plain-text
 * variants. Keep in step with the site footer (messages/*.json companyInfo)
 * and the legal pages.
 */
export const COMPANY_INFO =
  "SaleLinx Ltd, registered in England and Wales, company no. 17351832. " +
  "Registered office: 34 Sussex Place, London, W2 2TH, United Kingdom.";

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
 *   - a left-aligned masthead and headline, not centred
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
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:${theme.card};border:1px solid ${theme.hairline};border-radius:18px;padding:0;">
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
                    <td style="font-family:${FONT_STACK};font-size:12px;color:${theme.muted};">Vinted</td>
                  </tr>
                </table>
                <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:12px;line-height:1.65;color:${theme.faint};">
                  Run both shops from one panel.<br />
                  <a href="${siteUrl}" style="color:${theme.muted};text-decoration:none;">salelinx.com</a>
                </p>
                <p style="margin:0;font-family:${FONT_STACK};font-size:11px;line-height:1.65;color:${theme.faint};">
                  ${COMPANY_INFO}
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
