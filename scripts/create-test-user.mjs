// One-off: create a pre-confirmed test account (no email step needed).
//
// Usage:
//   node scripts/create-test-user.mjs test@test.com test123
//   node scripts/create-test-user.mjs                    (defaults to test@test.com / test123)
//
// Required env (read from the environment or .env.local):
//   NEXT_PUBLIC_SUPABASE_URL   (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  (dashboard: Settings > API - do not commit it)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env.local is optional; env vars may be set directly
  }
}

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

async function main() {
  loadEnvLocal();

  const email = process.argv[2] ?? 'test@test.com';
  const password = process.argv[3] ?? 'test123';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL not set');
  if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY not set');

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the confirmation-link step entirely
  });

  if (error) fail(`createUser failed: ${error.message}`);

  console.log(`Created ${data.user.email} (${data.user.id}) - ready to sign in immediately.`);
}

await main();
