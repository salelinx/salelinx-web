-- Register the four activity counters added after migration 038 as MONTHLY.
--
-- The extension now also tracks the photo editor, the two user-initiated
-- cloud-sync actions, and Vinted order cancels (salelinx-app:
-- src/entitlements/usage-tracking.ts, plus lib/admin/extension-features.ts
-- here for the labels).
--
-- Same caveat as 038: usage_feature_periods is the period lookup for the
-- server-derived-period variant of increment_usage_counter, which is still NOT
-- applied in production. The live function writes the client-sent period key
-- and the extension sends YYYY-MM for these, so this is inert config until
-- that lands. Inserting the rows now means an unknown-counter daily fallback
-- can never truncate them to one-day windows.

insert into public.usage_feature_periods (feature, period) values
  ('photo_edit', 'monthly'),
  ('cloud_save', 'monthly'),
  ('cloud_update', 'monthly'),
  ('order_cancel', 'monthly')
on conflict (feature) do update set period = excluded.period;
