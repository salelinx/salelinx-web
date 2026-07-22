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

export const LOGO_ATTACHMENT = {
  filename: "salelinx-logo.png",
  content_id: LOGO_CID,
  content:
    "iVBORw0KGgoAAAANSUhEUgAAADwAAABUCAIAAABROcMSAAAQW0lEQVR4nM1bB1gU1xa+U3aXqoIFMFHsgAJSotgRGygiYhAxMTEWEDXGEntejBpN0WeMGoPKs8QuomAsQVOUKPY8AQGVqs/IqsAWFtg6M+/bPXIzLgsusMScbz/YnbL3n3PP+U+5dwmNSoEaIhzHEQSRl5d/POnkJyuXMQxDkiRCiGXZtZ+vj4uLdXF2ZlkWDjaTkA29gSAIlmW7det69Fji/AUfUxTFsqxOp6MoSq3WjAt/W6VSwTWo2YRsxD2gyBnTP4jfsWvZ8k8oiuI4DiEUERGemZkVNeldlmU5g6B/DmiCIBBCQwYPoihq87dbFyxcLBQKWZbt7e3VpUvn1PMXYmLnUBTFMEwz4SYbc4/BXt3d3dq1a0dR1PfxOz9bvZYkSZFINDokmKbpg4cOr1j5L5qmdTrdP0jTDMPY2NgsXDCPYRiRSPTlVxu/3rCJIIiRI0fodDorK6tN32zZ/O1WgUCg1WotDppoKHvwOUSpVHbt5lFWXg7gNm74cv5HHy5ZumLL1u9EIpFarT64f29UVKROp6Np2oKgG0lMoGxra+thw4PgCEVRS5au+GH/wY0bvpz6/hS1Wi0UCqfNiL14Kc3idtJ4NgV+GDc2FPiEZVmKomJiZx86fCRhV/yECeM1Gg3HcROjJt+9m03TNMMwr9k8sIWIxWL3nr2VSiWoH4jlyKH9ERHhEyInnTlzjiAIZ2fny2m/dOzYkWEYiqJep6YJguA4zsXFpbe3F5gH6J7juOh33vv5l19PJh0LGhrIcZxYLB4/IapcIoFI9DpBI4Rgxv38fDF5g/oJgng7MvpK+tXzqWcC+vZBCGVn54wLn6BWq+Ga1wkaxMenN/8j6FKlUkVMmHjnTsaF82f79PFHCN269Uds3FySJJtu3E0CDdrt3r0b1jrGTVGUXF4xNiyipET88/lz3gYTOnLk2Fdf/7vpZNJ4R8RJyOPHj3t6+qrVarByfBYiefv27a+lXxIIhcOGB9+//4AgiBPHj44dO6Yp5G0BTbdq5dCyRYvaZ4ErSkpKho8crdVq0y7+4ufny3HcjJhZeXn5NE032iktANrGxrplq5b4Y23cBQWFQcNGqVTKC6lnR40cIZXK3pkyVavVNjoTtIAjEgQhEonqOsswDE3TRUXFo0LG6nS6M6eTVyxfkpV194PpMY1mwCZFRJ1Ox3EcSZIVFfU5BpQIDx7kDRsR/FPq+TWrV93540Z2ds532+PB7v8m0AzDEARB0zRBEBcvpUmlEiMvrH09SZK5uffCx0eGjZsgEAgy79zq2KGDRCJtRGHWYPZgWRbCh06nS0o6uSth95X0q2beS9ZUkyRJxs2KWbN6VcuWeg9uaHhvAGiO44CAEUInTiR/vXFTRkYmjufmD0nVmISDQ6tlSxfPnRMnEolgKmq7cpNAY2Vcv3Fz1ao1l9J+h+GNwoqZQhAERVEQYjw9e61ft2Z0SHADVK5RKV75qq6UalQKmeTZooXzYYopimp6k4AweAW8nz5taumzJ3is+l+v0DQ2ies3bs6eMy8nJ5cgCIvkD7UNvUeP7jvivxs0cMArTaU+bQH5UxS1Y2fC8BEhOTm5NE1zHGdBxKimgKBpOi8vf8TI0Vu3bcdZbp331DUFqmq5RqVQKyviZsXAVDZr0wgZVA7anTljGowOf2u/TINWVcvVygq59HlYmL6aAj5GzS9EjZWHhYUq5GVqZYVaWWEWaLhUIS8bFjQUISQQCNDfKwLDiKFjQqorpcoqWW3cxqDVygpllay6Ugo6bm7EpEFqTyOMGx0dZZJPjEHDFZMnTzKJGCybqiXmx4W6hCRJIyOE0b/8Yp1GpVBWyeoEDYjXrF6F74EoQNO0RapovgC+Xr16+vj0trOzxcfxQHjo/96+boT7L56GaHT+ws+Q0ADpGLGbo6ODk5OTs5OTs4uzQE9/SMfonj19VlpWVvq8tFwiMb8JRpIkx3F+fr4XUs9WVioyMrNSUy+knDotFotxXgABf3RI8KmUJH6wfAEa8lq5vMLHr29paSlwJ0LI1tbGy9MzMHBw//79e3t7Ojk5aTQasfjpw0ePCguLHj9+LBY/LSkRy+RyqVRaUiKGBoiZQhkwvTM5et/eBDgikUg3f7vl6w2b4JHgoJWVVUF+bts2baDU1x8ChYPyZ8XOxFMzfFjQ99u3Pix6ABcUFdyL/35beHhYhw4dkOWENhDcT+d+hDQBxoJnoCgKd39u37zKp22EEV+9cglUO3PGtGvpaXC6SiHZtnWzv79fbSXRBmmiI5IGad++fd79bEAC0GNjZvAznN9+Pc83az1oVbVcLn3eL6BvZOSE3OwMHF+2bd3cuXMnvlYsQhRGArA6dOhw4vhR7Gp/Pi6ys7MlCAL44MAPe9TKCsx9CKi7MD/3fOoZfE/mnVtDBg+CL20OoEaCEwR/f79FC+cfPXxAo1IsmD8PIQTV57Cgocaaxq/KinKNSnHowD4oKGiabu58A4tRbjNo4IDd/9lhZ2cLYQEhdOjAPoz7BWiI2xqVYueO7XCbxYnZ/BADQ9vb29na2uBEytnJqeTJQ1W1XFUtf4k99u/bbakEv4lCvawy+Dhp0kSIgC8cEdhDJBKBO6N/gBAvexGQ49kzKS8cEdijR4/ur8sqzBEwEje3HjLJMwQ8smL5Evw0/1ihDApdv26tXtNFBfesra2byGs4AWw+fiQNburo6KDPBncl7FYqlY1uG+NGglGfF4piC4JmawTJpc8h7DWmPcUj1xYt7N3d3fr08e/evZuNjZ6qLOshJEna29uNHDH8WnoaSv3ptMku7SsFAxoxfNixIwf/96gAWEhZJSsquLcj/jsvL8/G6aKuxizkVXr2WLpkUSNUAi775ptv8hMGo1eVQrJ82WKL6Js2FDUrVyxVVcsV8jIUOGRwQ/UBiPsF9H1UnAfgcI5VXirG70HxX6z/3CRufuVW/+g4bTp+7DDMJHrjjTcaZB6AeGjgEEnZU41KUSEr1agUudkZs+NiPTzcXVxc/P391q9bC0kBJDOTJk00wl3XM5gcES6OiorEcbBh3AwXDx40UFquz3oB2YEf9vCLPJCAvn1KnjxUVsmUVbLiwvu2tjaQ0eO8HlqPoWNCQkNHe3i4Y+gmn2T6tKkKeRl0YxrWm4Yn9vHp/fzpnxgxrpQEAgEwNEmSQqEQIRQSPEqtrADjeW/KuwghOI4Qmvr+lFs30rH1K6tkp1KSOnVyNTJUGDEp8QjuxrxwxAYh7tTJ9fH/CjHipMQjuPowOSc/XzgH4x09fAB03NrRMSU5iQ8Xt2Me3Lvr6OiApwLsODw8DNyG37Ixy7VBhQ4OrbIybmM7TklOEgqFdSVY2N9hmKyM29BFv3HtMmRqRn060MJH8+bCvYC4a9cuT/4sVlbJjC4m27ZpU78jwqOTJHk88Yi7u5tKpbKysrqSfjV68hSNRoMr+drCcZxEIoX31tbWAoHgh327fX19tFpt7fICVroG9O8HT6vVat3cepw+dbJtmza1fZTs0qVz/aChG/3F+rVDBg8CxBkZmeHj9VvZSJKsP1BDBYQQUigUC+Z/GBI8SqfT1dVqI0mysKgYVsxmzph2Oe23bt26mt7iBzNSl5HAcSjRYAbv/HEDJqd+cgWb3rN7JxiupOypTPIMu7/JPq2qWj4rduZ7U94FE6qn1Uskn0iMeDvKpM7AMAQCwe2bV3v06M6yrEwuHzAwsLj4IfRZoHMFFxslTNAlun3zqre3l5kbIvkLUfUvBpCDBw+CjZa1rwA7i5oY6ebWAxYwZ86cVVz8EPb2QBNIVyOwCspH3NrR0dXVFX/kXrUCBipgGAag12exLVrYh4SMMmkhoPuYmOkcxwkEguTkU2fPpUIGCxsz27RuHTcr5ptNG2bHxTq1a4efHP62bde2RQt7PGOEeUHXrApVo1Lcvnm1NnPBR1fXjji1CBwyGJQBpzw9ez16mI/t7FFxnq+vD5+2e/b0eOU6laZRLz0zeHt7hYWFwmoNf7IQQh7u7uDscnlFTk4unmWCIPbtSXBxdoY2qVqtdnFx2bt7F455CCGtVttM22RJMLjVq/S7LP9qS9aAdnR0BJQarUaj1WCzsba2/vH0WV//gP4DA9OvXhOJRBqNpmdPj4ED+mO3E4vFZeXlFtm0ZCT6qWRZtlevnosWflR7wVSpUsIyeGtHRxcXF2ya1dXVaz9fn5OTm5V1d82adXj9LiCgD/7eysqq/PyCeqJPo4XE4ePTf6308vIElsAj3b2bDYUjSZIfzZtrVAUKhUKKotq2a4vViatMUPbly+nNomlUYwkikWjfngQrKyu8sxs2xfx++QpN0yqVKmbm9GkfvI9ng2VZxiAfzp2N28k3b+pzDGz6J5NTmmPXOgn/YHndy8vz++1bIGrgTXYrP1kF0TsvL//GzVvgA5hTt275pn+/AEgnCguLrl2/AQ8MRJ6RkXklXU9NjEUXeU0sFK3+7FNM26CkkOBRv6f9yi/agWe+WP853AW0GBUVyed7eBM0NLD28lRTKY//AKBge3s7fAQmN/X8hSGBw4uLH4IWIb6s/uzTxR8vgFgoEAj2HziUmJjE394DhnTxUtrRo4l4o4SFNQ3KuHL5In+ZGhcjRrn58mWL+TpOPHoISlSjsAeBpk3r1kUF9yyo779AQ0rVL6AvnlkjzsZV8eKPF/ARnzt7SigU1hWo4av69wuokJXiEt0yoEEHl3//zSjnxPtIsaXOmT2Lj/jM6WQrK6v69yjgNXr+WBYADS64dMki2AcACN56y7+6UpqwKx6s3MbGZtnSj2FUQHwqRV9xmdM2oQ24x40bC2W8OdtnzNV06JgQvNyGENq3NwHOFuTlnEpJyn+QA1bUUMR83G+95Q+rb9WV0roKAnPZAwZ++uw5fIRw2KVLF5ZlNRpNx44dR4cEu7rqt5ozDCMQCE6fPvt2ZLRWq31lxYVFZ9gRe/v2HwMHDU1J+RFqQSAf1EB5SUnCmuoNXKqwsBAyfYZhtAbBifWkyVMgBgEnmqQOk7gpiiotK4uKfjd21pxnz58D9Ab/jIdv09OnTcU2TRCEh4c77s3h157dOzEP1rYNWJuqHz1Rc6+Ls/OWbzdB6dkgB33JppNPJBrxnZeX55FD++/nZuU/yElJTho/fhz/BwtgpqNGjtize2fQ0ED+Nll4eP4iL2Fq4QeG2Lc3AZcaDebp6kopbCnnx3AIKDi7x3EHOHtY0FC8EJ+bnbFt6+bQMSFtWreuS8dYjE45Ozn9e+NXwOWvBG283+Pa9RtDg0bC9+KSGCIzfg9xTqfTBY8aeTzxsJWVFSRMGIpEIs3Jzc3IyMzOzrl//8GfT0pkMml1tZKfNpEkaWtr4+Dg2LmTq5+fr7e3p7eXl4eHuzm+8dJmQsB94OChGTPj+L8C4asKc0t0dNR/dsXD7+PwhkB4b2ToarVaJpdXKiplMhljuJdA+iabnb1dq5YtIRlukBjvgMRZzuIly+/ezTZ5j7u72ycrlkHXmV+hGXUw8O6Y+jUH7ARzayblm9i2CbhVKtXRY8cTE5MyM7PKysvhh0F+fj4R48dNiIiwtbXBe5JfOQagNzlpZn6DkfwfM0RhUDSLF6UAAAAASUVORK5CYII=",
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
                      <img src="cid:${LOGO_CID}" width="20" height="28" alt="" style="display:block;width:20px;height:28px;border:0;outline:none;text-decoration:none;" />
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
