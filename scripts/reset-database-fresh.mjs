// One-off launch reset: wipes every user's data except two named admin
// accounts, and makes sure those two accounts are the only admins left.
// Mirrors delete-user-account.mjs (see docs/GDPR.md) for the per-user
// deletion steps: storage objects, Stripe customer, then the auth user
// (which cascades listings/subscriptions/etc via ON DELETE CASCADE).
//
// Dry run (default) prints what would happen. Nothing is removed without
// the --execute flag.
//
// Usage:
//   node scripts/reset-database-fresh.mjs
//   node scripts/reset-database-fresh.mjs --execute
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
const KEEP_EMAILS = ['matthew.valetsky@gmail.com', 'lewis@ludlam.com'];

// Tables keyed by user_id that a kept account might still own rows in.
// (auth.users deletion cascades these for everyone ELSE automatically -
// kept accounts survive, so their own rows need clearing separately.)
const USER_OWNED_TABLES = [
  'listings',
  'platform_credentials',
  'user_settings',
  'linked_accounts',
  'usage_counters',
  'subscriptions',
  'user_storage',
  'support_tickets',
  'referral_codes',
  'referrals',
];

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

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) fail(`listUsers failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) return users;
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

async function deleteStorage(supabase, userId, label) {
  const paths = await listStorageObjects(supabase, userId);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) fail(`storage remove failed for ${label}: ${error.message}`);
  }
  return paths.length;
}

async function deleteStripeCustomer(stripe, customerId, label) {
  if (!customerId || !stripe) return false;
  try {
    await stripe.customers.del(customerId);
    console.log(`  Deleted Stripe customer ${customerId} (${label}).`);
    return true;
  } catch (err) {
    console.warn(`  Stripe delete failed for ${label} (${customerId}): ${err.message}`);
    return false;
  }
}

async function main() {
  loadEnvLocal();
  const execute = process.argv.includes('--execute');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL not set');
  if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY not set');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripe = stripeKey ? new Stripe(stripeKey) : null;
  if (!stripe) {
    console.warn('STRIPE_SECRET_KEY not set - Stripe customers will not be cleaned up.\n');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const allUsers = await listAllUsers(supabase);
  const keepUsers = KEEP_EMAILS.map((email) => {
    const u = allUsers.find((x) => (x.email ?? '').toLowerCase() === email.toLowerCase());
    if (!u) fail(`keep-list email not found in auth.users: ${email}`);
    return u;
  });
  const keepIds = new Set(keepUsers.map((u) => u.id));
  const deleteUsers = allUsers.filter((u) => !keepIds.has(u.id));

  console.log(`Found ${allUsers.length} total users.`);
  console.log(`Keeping ${keepUsers.length}: ${keepUsers.map((u) => u.email).join(', ')}`);
  console.log(`Deleting ${deleteUsers.length}: ${deleteUsers.map((u) => u.email).join(', ')}\n`);

  const { data: currentAdmins } = await supabase.from('admin_users').select('user_id');
  console.log(`Current admin_users: ${(currentAdmins ?? []).length} row(s).`);
  console.log(`After reset, admin_users will be exactly: ${keepUsers.map((u) => u.email).join(', ')}\n`);

  if (!execute) {
    console.log('Dry run only. Re-run with --execute to apply.');
    return;
  }

  // 1. Delete every non-kept user (storage, Stripe, then auth user - cascades
  //    their owned rows the same way delete-user-account.mjs does).
  for (const user of deleteUsers) {
    console.log(`Deleting ${user.email} (${user.id})...`);
    const removed = await deleteStorage(supabase, user.id, user.email);
    if (removed) console.log(`  Removed ${removed} storage object(s).`);

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();
    await deleteStripeCustomer(stripe, sub?.stripe_customer_id, user.email);

    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) fail(`deleteUser failed for ${user.email}: ${delErr.message}`);
    console.log(`  Deleted auth user and cascaded rows.`);
  }

  // 2. Clear the two kept accounts' own data too (auth.users itself is not
  //    touched, so nothing cascades it away).
  for (const user of keepUsers) {
    console.log(`Clearing ${user.email}'s own data...`);
    const removed = await deleteStorage(supabase, user.id, user.email);
    if (removed) console.log(`  Removed ${removed} storage object(s).`);

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();
    await deleteStripeCustomer(stripe, sub?.stripe_customer_id, user.email);

    for (const table of USER_OWNED_TABLES) {
      const { error } = await supabase.from(table).delete().eq('user_id', user.id);
      if (error) fail(`clearing ${table} failed for ${user.email}: ${error.message}`);
    }
    // referrals can also reference a kept user as referrer, not just referee
    await supabase.from('referrals').delete().eq('referrer_id', user.id);
    console.log(`  Cleared owned rows in: ${USER_OWNED_TABLES.join(', ')}`);
  }

  // 3. admin_users: wipe, then re-grant exactly the two kept accounts.
  const { error: adminDelErr } = await supabase
    .from('admin_users')
    .delete()
    .not('user_id', 'is', null);
  if (adminDelErr) fail(`clearing admin_users failed: ${adminDelErr.message}`);
  const { error: adminInsErr } = await supabase
    .from('admin_users')
    .insert(keepUsers.map((u) => ({ user_id: u.id })));
  if (adminInsErr) fail(`granting admin_users failed: ${adminInsErr.message}`);
  console.log(`\nadmin_users reset to: ${keepUsers.map((u) => u.email).join(', ')}`);

  // 4. Audit log: full wipe for a clean slate.
  const { error: auditErr } = await supabase
    .from('admin_audit_log')
    .delete()
    .not('id', 'is', null);
  if (auditErr) fail(`clearing admin_audit_log failed: ${auditErr.message}`);
  console.log('admin_audit_log cleared.');

  console.log('\nDone. tier_limits was left untouched (it is config, not user data).');
}

await main();
