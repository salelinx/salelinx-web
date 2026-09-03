// Helpers shared by the ops scripts in this folder.

// Emails are personal data: keep them out of console output (terminal
// scrollback, CI logs, screenshots). Any change to the masking rule lands in
// every script at once because they all import this copy.
export function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}
