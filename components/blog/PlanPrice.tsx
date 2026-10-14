import { TIER_PRICES } from '@/lib/pricing';

// A plan's monthly price in pounds, read from the same table the pricing page
// uses, so a post never goes on quoting a price we no longer charge. GBP
// only: the blog is written for UK sellers.
export function PlanPrice({ tier }: { tier: keyof typeof TIER_PRICES }) {
  return <>{TIER_PRICES[tier].gbp}</>;
}
