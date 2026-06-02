-- support_tickets: allow 'other' as a ticket type
--
-- The original CHECK from migration 009 only permitted ('bug','feature',
-- 'feedback'). Both the website (/help/support) and the extension Support tab
-- now offer an "Other" option in the type dropdown, so widen the constraint to
-- include 'other'. The inline CHECK from 009 is auto-named
-- support_tickets_type_check; drop it (if present) and re-add a named one.

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_type_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_type_check
  CHECK (type IN ('bug', 'feature', 'feedback', 'other'));
