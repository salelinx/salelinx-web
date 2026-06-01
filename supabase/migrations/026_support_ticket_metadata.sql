-- support_tickets: diagnostic metadata + source tagging
--
-- Adds columns the web form and the extension form attach to a ticket so
-- staff (and the /account/support admin view) have triage context without a
-- round-trip:
--
--   app_version  - extension chrome.runtime.getManifest().version; null for web
--   tier_id      - the reporter's plan at submit time (free text, NOT an FK)
--   source       - which surface filed the ticket: 'web' | 'extension' | 'email'
--   user_agent   - browser/UA string of the submitting surface
--   locale       - UI locale at submit time ('en' | 'fr' | 'es' | 'de')
--
-- IMPORTANT: these are UNTRUSTED, DISPLAY-ONLY diagnostics. The user INSERT
-- policy only checks auth.uid() = user_id, so a browser client can set any of
-- these values. Never branch authorization or entitlement logic on tier_id or
-- source - read the real tier from `subscriptions` if a decision depends on it.
--
-- All columns are nullable (source has a default) so the extension's existing
-- insert (user_id/type/message/platform only) keeps working unchanged.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS tier_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'extension', 'email')),
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT;

-- Harden the user INSERT policy so a browser client can't impersonate the
-- inbound-email source. Replaces the 009 policy (auth.uid() = user_id only).
-- 'email'-sourced rows are created by the service role (Edge Function), which
-- bypasses RLS, so users never legitimately set source = 'email'.
DROP POLICY IF EXISTS "Users can insert own tickets" ON public.support_tickets;

CREATE POLICY "Users can insert own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (source IS NULL OR source IN ('web', 'extension'))
  );
