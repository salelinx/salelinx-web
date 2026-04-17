import { createServerClient } from "./server";
import type { TierConfig } from "@/lib/types/tiers";

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
