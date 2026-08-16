// Disposable / throwaway email domains we refuse to grant free trials to.
// This is deterrence, not perfection: the list covers the popular services a
// casual trial-farmer reaches for first. Keep it in sync with the website
// copy at lib/auth/disposable-domains.ts (copy-paste, same as shared types).
//
// Used server-side in create-checkout-session (the enforcement point: a
// disposable-email account can still sign up and pay, it just never gets the
// free trial) and client-side at signup for early, friendly feedback.

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "33mail.com",
  "anonaddy.me",
  "burnermail.io",
  "byom.de",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "inboxkitten.com",
  "mail-temp.com",
  "mail.tm",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mailpoof.com",
  "mailsac.com",
  "minuteinbox.com",
  "mohmal.com",
  "mytemp.email",
  "sharklasers.com",
  "spamgourmet.com",
  "temp-mail.io",
  "temp-mail.org",
  "tempail.com",
  "tempinbox.com",
  "tempmail.dev",
  "tempmail.plus",
  "tempmailo.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@").pop()?.toLowerCase().trim() ?? "";
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
