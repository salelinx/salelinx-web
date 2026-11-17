-- A Shopify store's tokens arrive before its SaleLinx account. Since 2026-11-13
-- the app installs through Shopify's managed install and opens as a page in the
-- store's admin, which takes the store's tokens straight away (token exchange,
-- App Store rule 2.3.2). The seller connects the store to an account after that,
-- on the website or from the extension, so a row may have no user yet.
--
-- shopify_tokens is keyed by the store now, and user_id is one store per account
-- (unique, nullable). shop_id was already unique and not null.
--
-- One transaction, so a name that differs on live changes nothing.

BEGIN;

ALTER TABLE public.shopify_tokens DROP CONSTRAINT shopify_tokens_pkey;
ALTER TABLE public.shopify_tokens DROP CONSTRAINT shopify_tokens_shop_id_key;
ALTER TABLE public.shopify_tokens ADD CONSTRAINT shopify_tokens_pkey PRIMARY KEY (shop_id);
ALTER TABLE public.shopify_tokens ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.shopify_tokens ADD CONSTRAINT shopify_tokens_user_id_key UNIQUE (user_id);

COMMIT;
