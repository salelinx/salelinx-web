// GDPR account deletion runbook script. See docs/GDPR.md.
//
// Deletes everything SaleLinx holds about one user:
//   1. Storage objects under listing-images/{userId}/ (DB cascade does not
//      touch Storage)
//   2. The Stripe customer (cancels any active subscription and detaches the
//      payment method; Stripe retains invoices for legal/tax reasons)
//   3. The auth.users row - ON DELETE CASCADE then removes listings,
//      platform_credentials, user_settings, linked_accounts, subscriptions,
//      usage_counters, user_storage, support_tickets, and replies
//
// Dry run (default) prints what would be deleted. Nothing is removed without
// the --execute flag.
//
// Usage:
//   node scripts/delete-user-account.mjs user@example.com
//   node scripts/delete-user-account.mjs user@example.com --execute
//
// Required env (read from the environment or .env.local):
//   NEXT_PUBLIC_SUPABASE_URL   (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  (dashboard: Settings > API - do not commit it)
//   STRIPE_SECRET_KEY          (optional; skip Stripe cleanup if absent)

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUCKET = 'listing-images';

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

async function findUserByEmail(supabase, email) {
  const needle = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) fail(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === needle);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function listStorageObjects(supabase, userId) {
  const paths = [];
  const { data: folders, error } = await supabase.storage
    .from(BUCKET)
    .list(userId, { limit: 1000 });
  if (error) fail(`storage list failed: ${error.message}`);
  for (const entry of folders ?? []) {
    if (entry.id) {
      // A file directly under the user folder (not the usual layout)
      paths.push(`${userId}/${entry.name}`);
      continue;
    }
    const { data: files, error: fileErr } = await supabase.storage
      .from(BUCKET)
      .list(`${userId}/${entry.name}`, { limit: 1000 });
    if (fileErr) fail(`storage list failed: ${fileErr.message}`);
    for (const f of files ?? []) paths.push(`${userId}/${entry.name}/${f.name}`);
  }
  return paths;
}

async function countRows(supabase, table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) fail(`count ${table} failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  loadEnvLocal();

  const email = process.argv[2];
  const execute = process.argv.includes('--execute');
  if (!email || email.startsWith('--')) {
    fail('usage: node scripts/delete-user-account.mjs <email> [--execute]');
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL not set');
  if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY not set');

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const user = await findUserByEmail(supabase, email);
  if (!user) fail(`no auth user found for ${email}`);
  console.log(`User: ${user.email} (${user.id}), created ${user.created_at}`);

  const [listings, tickets, storagePaths] = await Promise.all([
    countRows(supabase, 'listings', user.id),
    countRows(supabase, 'support_tickets', user.id),
    listStorageObjects(supabase, user.id),
  ]);

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, status, tier_id')
    .eq('user_id', user.id)
    .maybeSingle();

  console.log(`  listings rows:      ${listings}`);
  console.log(`  support tickets:    ${tickets}`);
  console.log(`  storage objects:    ${storagePaths.length}`);
  console.log(
    `  stripe customer:    ${sub?.stripe_customer_id ?? 'none'}${sub ? ` (${sub.tier_id}, ${sub.status})` : ''}`,
  );

  if (!execute) {
    console.log('\nDry run only. Re-run with --execute to delete.');
    return;
  }

  // 1. Storage (not covered by DB cascade)
  for (let i = 0; i < storagePaths.length; i += 100) {
    const chunk = storagePaths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) fail(`storage remove failed: ${error.message}`);
  }
  console.log(`Deleted ${storagePaths.length} storage objects.`);

  // 2. Stripe customer. Deleting the customer cancels active subscriptions;
  // invoices survive customer deletion (we must retain them for tax law).
  if (sub?.stripe_customer_id) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.warn(
        'STRIPE_SECRET_KEY not set - delete the Stripe customer manually in the dashboard.',
      );
    } else {
      // No pinned apiVersion here on purpose: customers.del is stable and the
      // repo-wide version pin lives in lib/stripe.ts + the Edge Functions.
      const stripe = new Stripe(stripeKey);
      await stripe.customers.del(sub.stripe_customer_id);
      console.log(`Deleted Stripe customer ${sub.stripe_customer_id}.`);
    }
  }

  // 3. Auth user - cascades all remaining user-owned rows
  const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
  if (delErr) fail(`deleteUser failed: ${delErr.message}`);
  console.log(`Deleted auth user ${user.id} and all cascaded rows.`);

  console.log(
    '\nDone. Remaining manual steps (see docs/GDPR.md): purge any emails from',
    'this user in the support@salelinx.com inbox, and confirm no admin_audit_log',
    'entries reference them.',
  );
}

await main();
