-- =============================================================================
-- 035: Uninstall feedback
-- =============================================================================
-- The extension sets chrome.runtime.setUninstallURL to /uninstall, the only
-- exit signal Chrome gives us. The page offers one-click reasons plus an
-- optional comment, and writes here.
--
-- Anonymous BY DESIGN, not by accident: the visitor has just uninstalled and
-- is almost certainly signed out, and tying churn feedback to an identity
-- would make this personal data for no product benefit (docs/GDPR.md). No
-- user_id, no email, no IP. That also means the ON DELETE CASCADE rule for
-- user-owned tables does not apply: there is no owner to cascade from.
--
-- Abuse surface: anon INSERT with no SELECT/UPDATE/DELETE. Writes are shaped
-- by CHECK constraints (enumerated reason, hard length caps) so the worst a
-- script can do is add noise rows, which cost nothing and read as outliers.

CREATE TABLE public.uninstall_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Enumerated in the page's reason chips; 'other' pairs with the comment box.
  reason text NOT NULL CHECK (
    reason IN (
      'too_expensive',
      'missing_feature',
      'not_working',
      'stopped_selling',
      'switched_tool',
      'other'
    )
  ),
  comment text CHECK (char_length(comment) <= 500),
  -- Extension version and panel locale from the uninstall URL params, for
  -- slicing feedback by release and market. Free-form (they arrive in a URL),
  -- so capped.
  version text CHECK (char_length(version) <= 20),
  locale text CHECK (char_length(locale) <= 10)
);

ALTER TABLE public.uninstall_feedback ENABLE ROW LEVEL SECURITY;

-- Write-only for the public page. No SELECT policy: feedback is read in the
-- Supabase dashboard (or a future admin surface via is_admin()), never by
-- the site.
CREATE POLICY uninstall_feedback_insert ON public.uninstall_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
