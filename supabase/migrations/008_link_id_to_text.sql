-- Change link_id from UUID to TEXT so it can store Depop listing IDs (e.g. "depop_abc123")
-- The link_id on a Vinted cloud row stores the linked Depop listing's IDB composite ID

ALTER TABLE public.listings ALTER COLUMN link_id TYPE TEXT;
