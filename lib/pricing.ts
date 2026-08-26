// Display prices per currency for the pricing page.
//
// These strings must mirror the currency_options on the three live Stripe
// prices exactly - the page advertises what checkout will charge. If a price
// changes in Stripe, change it here too (see docs/STRIPE.md "Changing a
// price").
//
// Currency is resolved server-side from the visitor's country (Vercel's
// x-vercel-ip-country header) with the locale as fallback, approximating
// Stripe Checkout's own IP-based currency pick. GBP stays the default so a
// visitor we cannot place sees what we charge by default.

export type PriceCurrency = "gbp" | "eur" | "usd";

export const CURRENCY_SYMBOL: Record<PriceCurrency, string> = {
  gbp: "£",
  eur: "€",
  usd: "$",
};

export const TIER_PRICES: Record<
  "starter" | "pro" | "business",
  Record<PriceCurrency, string>
> = {
  starter: { gbp: "£7.99", eur: "€8.99", usd: "$9.99" },
  pro: { gbp: "£14.99", eur: "€16.99", usd: "$18.99" },
  business: { gbp: "£24.99", eur: "€28.99", usd: "$31.99" },
};

// Countries whose card will be charged EUR by Stripe's currency_options pick.
// Eurozone only: EU members outside the euro (SE, PL, DK, ...) are charged in
// the price's default currency, so they see GBP here to match.
const EUROZONE = new Set([
  "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
]);

const EURO_LOCALES = new Set(["fr", "es", "de"]);

export function resolveCurrency(
  country: string | null,
  locale: string,
): PriceCurrency {
  if (country) {
    const c = country.toUpperCase();
    if (c === "GB") return "gbp";
    if (c === "US") return "usd";
    if (EUROZONE.has(c)) return "eur";
    // Placed somewhere else: Stripe will charge the GBP default, so show GBP
    // regardless of locale - the locale fallback below is only for when we
    // have no location at all (local dev, non-Vercel hosting).
    return "gbp";
  }
  return EURO_LOCALES.has(locale) ? "eur" : "gbp";
}
