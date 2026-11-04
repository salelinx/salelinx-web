-- Etsy listings sync to the cloud like the other platforms.

ALTER TABLE public.listings DROP CONSTRAINT listings_platform_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_platform_check
  CHECK (platform IN ('depop', 'vinted', 'ebay', 'etsy'));
