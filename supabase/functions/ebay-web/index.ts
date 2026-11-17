// Supabase Edge Function: ebay-web
// ------------------------------------------------------------------------
// The ebay function's code under a name of its own, for the website's eBay page
// (components/EbayConnect.tsx) only. The extension keeps calling `ebay`, so a change
// made for the website goes live here first and reaches no one using the extension
// until `ebay` itself is deployed. Same actions, same secrets, plus EBAY_RUNAME_WEB
// for client 'web'. See docs/EDGE-FUNCTIONS.md "eBay".

import '../ebay/index.ts';
