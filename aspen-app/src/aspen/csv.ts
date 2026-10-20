// CSV parsing and column validation (no external dependency).
import type { Campaign, Merchant, Redemption, ReferenceSummary } from "./models";

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0]!.map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

export function headerOf(text: string): string[] {
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";
  return first.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
}

export const REQUIRED_COLUMNS = {
  merchants: ["merchant_id", "business_name"],
  campaigns: [
    "campaign_id",
    "merchant_id",
    "discount_pct",
    "min_spend_try",
    "redemption_cap",
    "valid_from",
    "valid_until",
    "eligible_window",
    "status",
  ],
  redemptions: [
    "event_id",
    "campaign_id",
    "merchant_id",
    "redemption_code",
    "timestamp_local",
    "status",
    "basket_value_try",
    "data_status",
    "notes",
  ],
  reference: [
    "campaign_id",
    "merchant_id",
    "verified_uses",
    "recorded_eligible_basket_try",
    "recorded_discount_try",
  ],
} as const;

export type FileKind = keyof typeof REQUIRED_COLUMNS;

export function validateColumns(kind: FileKind, text: string): string[] {
  const h = new Set(headerOf(text));
  return REQUIRED_COLUMNS[kind].filter((c) => !h.has(c));
}

const g = (r: Record<string, string>, k: string): string => r[k] ?? "";

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const toMerchants = (text: string): Merchant[] =>
  parseCsv(text).map((r) => ({
    merchant_id: g(r, "merchant_id"),
    business_name: g(r, "business_name"),
    business_type: g(r, "business_type") ?? "",
    address_or_maps_link: g(r, "address_or_maps_link") ?? "",
    contact_person: g(r, "contact_person") ?? "",
    primary_goal: g(r, "primary_goal") ?? "",
    desired_times: g(r, "desired_times") ?? "",
    average_ticket_try: num(g(r, "average_ticket_try")),
    monthly_promo_budget_band: g(r, "monthly_promo_budget_band") ?? "",
    preferred_benefits: g(r, "preferred_benefits") ?? "",
  }));

export const toCampaigns = (text: string): Campaign[] =>
  parseCsv(text).map((r) => ({
    campaign_id: g(r, "campaign_id"),
    merchant_id: g(r, "merchant_id"),
    goal: g(r, "goal") ?? "",
    discount_pct: num(g(r, "discount_pct")) ?? 0,
    min_spend_try: num(g(r, "min_spend_try")),
    redemption_cap: num(g(r, "redemption_cap")) ?? 0,
    budget_try: num(g(r, "budget_try")),
    valid_from: g(r, "valid_from"),
    valid_until: g(r, "valid_until"),
    eligible_window: g(r, "eligible_window") ?? "",
    status: g(r, "status") ?? "",
    review_notes: g(r, "review_notes") ?? "",
  }));

export const toRedemptions = (text: string): Redemption[] =>
  parseCsv(text).map((r) => ({
    event_id: g(r, "event_id"),
    campaign_id: g(r, "campaign_id"),
    merchant_id: g(r, "merchant_id"),
    redemption_code: g(r, "redemption_code"),
    timestamp_local: g(r, "timestamp_local"),
    status: (g(r, "status") ?? "").toLowerCase(),
    basket_value_try: num(g(r, "basket_value_try")),
    data_status: g(r, "data_status") ?? "",
    notes: g(r, "notes") ?? "",
  }));

export const toReference = (text: string): ReferenceSummary[] =>
  parseCsv(text).map((r) => ({
    campaign_id: g(r, "campaign_id"),
    merchant_id: g(r, "merchant_id"),
    verified_uses: num(g(r, "verified_uses")) ?? 0,
    duplicate_attempts: num(g(r, "duplicate_attempts")) ?? 0,
    invalid_attempts: num(g(r, "invalid_attempts")) ?? 0,
    recorded_eligible_basket_try: num(g(r, "recorded_eligible_basket_try")) ?? 0,
    discount_pct: num(g(r, "discount_pct")) ?? 0,
    max_uses: num(g(r, "max_uses")) ?? 0,
    remaining_uses: num(g(r, "remaining_uses")) ?? 0,
    recorded_discount_try: num(g(r, "recorded_discount_try")) ?? 0,
    usage_of_cap: num(g(r, "usage_of_cap")) ?? 0,
    interpretation: g(r, "interpretation") ?? "",
  }));
