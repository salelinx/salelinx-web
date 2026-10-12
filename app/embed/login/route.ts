// The extension's login form, framed in its sign-in bubble so Chrome saves SaleLinx passwords
// under this origin. It never signs in itself: the extension frame above it does.

const STORE_EXTENSION_ID = 'oichfmfogobecihmhlgkfcfbdceomenj';

function extensionOrigins(): string[] {
  const ids = [STORE_EXTENSION_ID, ...(process.env.EMBED_EXTENSION_IDS ?? '').split(',')];
  return [...new Set(ids.map((id) => id.trim()).filter((id) => /^[a-p]{32}$/.test(id)))].map(
    (id) => `chrome-extension://${id}`,
  );
}

const page = (origins: string[]) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>SaleLinx</title>
<style>
  :root { --field: #fafafa; --line: rgba(0,0,0,.12); --text: #18181b; --muted: #52525b; --focus: #059669; --accent: #047857; --accentText: #fff; --error: #ef4444; color-scheme: light; }
  :root.dark { --field: #111114; --line: rgba(255,255,255,.14); --text: #fafafa; --muted: #a1a1aa; --focus: #34d399; --accent: #10b981; --accentText: #052e1f; color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; color: var(--text); font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  form { display: flex; flex-direction: column; gap: 14px; padding: 3px; }
  label { display: block; font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 7px; text-align: left; letter-spacing: .1px; }
  input { width: 100%; height: 42px; padding: 0 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--field); color: var(--text); font: inherit; outline: none; transition: border-color .15s, box-shadow .15s; }
  input:focus { border-color: var(--focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 20%, transparent); }
  input:-webkit-autofill { -webkit-text-fill-color: var(--text); -webkit-box-shadow: 0 0 0 1000px var(--field) inset; }
  button { height: 44px; border: 0; border-radius: 8px; background: var(--accent); color: var(--accentText); font: inherit; font-weight: 600; cursor: pointer; margin-top: 8px; }
  button:disabled { opacity: 0.7; cursor: default; }
  .error { color: var(--error); font-size: 12px; text-align: left; min-height: 0; }
  .error:empty { display: none; }
  .done { padding: 40px 0; text-align: center; color: var(--muted); }
</style>
</head>
<body>
<form id="form" autocomplete="on" hidden>
  <div><label for="email" id="emailLabel">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
  <div><label for="password" id="passwordLabel">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
  <div class="error" id="error" role="alert"></div>
  <button id="submit" type="submit">Log In</button>
</form>
<div class="done" id="done" hidden></div>
<script>
(() => {
  const allowed = ${JSON.stringify(origins)};
  const q = new URLSearchParams(location.search);
  if (q.get('theme') === 'dark') document.documentElement.classList.add('dark');
  // The panel passes its own theme colours so the form matches the card it sits in.
  for (const key of ['field', 'line', 'text', 'muted', 'focus', 'accent', 'accentText', 'error']) {
    const v = q.get(key);
    if (v && /^[#a-z0-9(),.%\\s-]{1,60}$/i.test(v)) document.documentElement.style.setProperty('--' + key, v);
  }
  const parentOrigin = (location.ancestorOrigins && location.ancestorOrigins[0]) || '';
  const $ = (id) => document.getElementById(id);
  if (q.has('done')) { $('done').hidden = false; $('done').textContent = q.get('signed_in') || ''; return; }
  if (!allowed.includes(parentOrigin)) return;
  for (const [id, key] of [['emailLabel', 'email'], ['passwordLabel', 'password'], ['submit', 'login']]) {
    if (q.get(key)) $(id).textContent = q.get(key);
  }
  $('form').hidden = false;
  const report = () => window.parent.postMessage({ type: 'salelinx-login-height', height: Math.ceil(document.body.getBoundingClientRect().height) }, parentOrigin);
  // Chrome pauses rendering in a frame the panel keeps hidden while loading, so report once now too.
  report();
  new ResizeObserver(report).observe(document.body);
  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    $('submit').disabled = true;
    $('error').textContent = '';
    window.parent.postMessage(
      { type: 'salelinx-login', email: $('email').value.trim(), password: $('password').value },
      parentOrigin,
    );
  });
  window.addEventListener('message', (e) => {
    if (e.origin !== parentOrigin || e.source !== window.parent || e.data?.type !== 'salelinx-login-result') return;
    if (e.data.ok) {
      // A navigation after submit is what tells Chrome the login worked, so it offers to save it.
      const next = new URLSearchParams({ done: '1', theme: q.get('theme') || '', signed_in: q.get('signed_in') || '' });
      location.href = location.pathname + '?' + next;
      return;
    }
    $('submit').disabled = false;
    $('error').textContent = q.get(e.data.invalid ? 'invalid' : 'network') || (e.data.invalid ? 'Invalid email or password' : 'Could not sign in. Try again.');
  });
})();
</script>
</body>
</html>`;

export function GET(): Response {
  const origins = extensionOrigins();
  return new Response(page(origins), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': [
        "default-src 'none'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline'",
        "form-action 'none'",
        "base-uri 'none'",
        // Every ancestor must match, the marketplace page included. The script only shows the form
        // when its direct parent is the extension, which is the check that matters.
        `frame-ancestors ${origins.join(' ')} https:`,
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
