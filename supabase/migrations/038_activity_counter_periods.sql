-- Register the extension's activity counters as MONTHLY buckets.
--
-- The extension now records uncapped activity counters for every feature that
-- is not tier-metered (offers, chat replies, shipping labels, restocker,
-- feedback, shop designer, discounts, CSV import, linking, listing edits and
-- the bulk listing tools) so the admin console's Extension usage page shows
-- full per-user feature coverage (lib/admin/extension-features.ts holds the
-- roster; the extension writes via src/entitlements/usage-tracking.ts).
--
-- usage_feature_periods is the period lookup for the server-derived-period
-- variant of increment_usage_counter (salelinx-app repo,
-- supabase/migrations/20260813_usage_period_key_server_side.sql). As of this
-- migration that variant is NOT applied in production: the live function still
-- writes the client-sent period key, and the extension already sends YYYY-MM
-- for these counters, so this table is inert config until that lands. It is
-- created here (idempotently, same DDL) so the rows are in place first and an
-- unknown-counter daily fallback never truncates these to one-day windows.
-- Web abuse rate-limit counters (checkout_sessions etc.) are deliberately NOT
-- listed: they must stay daily.

create table if not exists public.usage_feature_periods (
  feature text primary key,
  period text not null check (period in ('daily', 'monthly'))
);

-- No policies: only SECURITY DEFINER functions and the service role need it.
alter table public.usage_feature_periods enable row level security;

insert into public.usage_feature_periods (feature, period) values
  ('follow', 'daily'),
  ('unfollow', 'daily'),
  ('refresh', 'daily'),
  ('crosslist', 'monthly'),
  ('relist', 'monthly'),
  ('offer_accept', 'monthly'),
  ('offer_decline', 'monthly'),
  ('offer_counter', 'monthly'),
  ('offer_auto_accept', 'monthly'),
  ('offer_send', 'monthly'),
  ('auto_markdown', 'monthly'),
  ('chat_reply', 'monthly'),
  ('shipping_label', 'monthly'),
  ('restock', 'monthly'),
  ('feedback', 'monthly'),
  ('shop_design', 'monthly'),
  ('shop_sale', 'monthly'),
  ('csv_import', 'monthly'),
  ('listing_link', 'monthly'),
  ('listing_edit', 'monthly'),
  ('listing_delete', 'monthly'),
  ('listing_duplicate', 'monthly'),
  ('listing_publish', 'monthly'),
  ('relist_sold', 'monthly')
on conflict (feature) do update set period = excluded.period;
