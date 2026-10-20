// Data models for Aspen Workstream 3. Field names follow the shared data contract.

export type RedemptionStatus = "valid" | "duplicate" | "invalid";

export interface Merchant {
  merchant_id: string;
  business_name: string;
  business_type: string;
  address_or_maps_link: string;
  contact_person: string;
  primary_goal: string;
  desired_times: string;
  average_ticket_try: number | null;
  monthly_promo_budget_band: string;
  preferred_benefits: string;
}

export interface Campaign {
  campaign_id: string;
  merchant_id: string;
  goal: string;
  discount_pct: number; // 0.10 = 10%
  min_spend_try: number | null;
  redemption_cap: number;
  budget_try: number | null;
  valid_from: string; // YYYY-MM-DD
  valid_until: string;
  eligible_window: string;
  status: string; // DRAFT in demo
  review_notes: string;
}

export interface Redemption {
  event_id: string;
  campaign_id: string;
  merchant_id: string;
  redemption_code: string;
  timestamp_local: string; // "YYYY-MM-DD HH:mm[:ss]" Europe/Istanbul, naive
  status: RedemptionStatus | string;
  basket_value_try: number | null;
  data_status: string;
  notes: string;
}

export interface ReferenceSummary {
  campaign_id: string;
  merchant_id: string;
  verified_uses: number;
  duplicate_attempts: number;
  invalid_attempts: number;
  recorded_eligible_basket_try: number;
  discount_pct: number;
  max_uses: number;
  remaining_uses: number;
  recorded_discount_try: number;
  usage_of_cap: number;
  interpretation: string;
}

export interface Dataset {
  merchants: Merchant[];
  campaigns: Campaign[];
  redemptions: Redemption[];
  reference: ReferenceSummary[];
}

export const FINANCIAL_RULES = {
  maxEligibleBasketTry: 600,
  maxDiscountPerRedemptionTry: 60,
} as const;

export type FlagCode =
  | "counted"
  | "repeat_valid_code"
  | "below_min_spend"
  | "missing_basket"
  | "outside_window"
  | "outside_dates"
  | "basket_capped"
  | "discount_capped"
  | "unknown_status"
  | "unknown_campaign"
  | "merchant_mismatch"
  | "not_counted_duplicate"
  | "not_counted_invalid";

export interface EnrichedRedemption extends Redemption {
  date: string; // YYYY-MM-DD (local)
  hour: number; // 0-23 (local)
  weekday: number; // 0=Sun
  counted: boolean; // counts toward usage & cost
  eligible_basket: number | null;
  recorded_discount: number | null;
  flags: FlagCode[];
}
