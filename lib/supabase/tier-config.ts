import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "./server";
import type { TierConfig } from "@/lib/types/tiers";

// Fresh read for the admin console: an admin editing caps must see the result
// of their own write on the next render, so no cache layer here.
export async function getTierConfigs(): Promise<TierConfig[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("tier_limits")
    .select("*")
    .is("effective_until", null)
    .order("tier_id");

  if (error || !data) return [];
  return data as TierConfig[];
}

// Cached read for public pages (homepage, /features). tier_limits is
// public-read and identical for every visitor, so the query runs at most once
// per minute per server instead of once per page view. Uses a cookie-less
// client because unstable_cache cannot touch cookies(), and the data is not
// user-scoped anyway.
export const getCachedTierConfigs = unstable_cache(
  async (): Promise<TierConfig[]> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .from("tier_limits")
      .select("*")
      .is("effective_until", null)
      .order("tier_id");

    if (error || !data) return [];
    return data as TierConfig[];
  },
  ["tier-configs"],
  { revalidate: 60 },
);
