export type TierId = "free" | "starter" | "pro" | "business";

export type FeatureKind = "boolean" | "metered" | "quota";
export type Period = "daily" | "monthly";

export interface TierConfig {
  tier_id: TierId;
  version: number;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  effective_from: string;
  effective_until: string | null;
}

export interface GateResult {
  allowed: boolean;
  reason?:
    | "feature_disabled"
    | "limit_exceeded"
    | "quota_exceeded"
    | "not_linked";
  current?: number;
  cap?: number | null;
  resetsAt?: string;
}
