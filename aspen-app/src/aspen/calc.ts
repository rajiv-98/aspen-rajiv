// Deterministic aggregation & financial calculations. Pure functions, no I/O.
import {
  FINANCIAL_RULES,
  type Campaign,
  type Dataset,
  type EnrichedRedemption,
  type FlagCode,
  type Redemption,
} from "./models";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse a naive Istanbul-local timestamp without any timezone conversion. */
export function parseLocal(ts: string): { date: string; hour: number; minute: number; weekday: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(ts ?? "");
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1) as [string, string, string, string, string];
  const weekday = new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay();
  return { date: `${y}-${mo}-${d}`, hour: +h, minute: +mi, weekday };
}

export interface EligibleWindow {
  days: number[];
  startMin: number;
  endMin: number;
}

export function parseWindow(s: string): EligibleWindow | null {
  const m = /^(\w+)(?:-(\w+))?\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const [a, b, h1, m1, h2, m2] = m.slice(1) as [string, string | undefined, string, string, string, string];
  let days: number[];
  if (/^every/i.test(a)) days = [0, 1, 2, 3, 4, 5, 6];
  else {
    const i = DAYS.indexOf(a);
    const j = b ? DAYS.indexOf(b) : i;
    if (i < 0 || j < 0) return null;
    days = [];
    for (let k = i; ; k = (k + 1) % 7) {
      days.push(k);
      if (k === j) break;
    }
  }
  return { days, startMin: +h1 * 60 + +m1, endMin: +h2 * 60 + +m2 };
}

export function eligibleBasket(basket: number | null): number | null {
  if (basket === null || !Number.isFinite(basket)) return null;
  return Math.min(basket, FINANCIAL_RULES.maxEligibleBasketTry);
}

export function recordedDiscount(eligible: number | null, discountPct: number): number | null {
  if (eligible === null) return null;
  return round2(Math.min(eligible * discountPct, FINANCIAL_RULES.maxDiscountPerRedemptionTry));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Annotate every ledger event with calculated fields and flags. Never mutates input. */
export function enrichRedemptions(ds: Dataset): EnrichedRedemption[] {
  const campaigns = new Map(ds.campaigns.map((c) => [c.campaign_id, c]));
  const seenValid = new Set<string>();
  const sorted = [...ds.redemptions].sort((a, b) =>
    a.timestamp_local === b.timestamp_local
      ? a.event_id.localeCompare(b.event_id)
      : a.timestamp_local.localeCompare(b.timestamp_local),
  );
  const out = new Map<string, EnrichedRedemption>();
  for (const r of sorted) out.set(r.event_id + "|" + r.timestamp_local, enrichOne(r, campaigns, seenValid));
  // preserve original ledger order
  return ds.redemptions.map((r) => out.get(r.event_id + "|" + r.timestamp_local)!);
}

function enrichOne(r: Redemption, campaigns: Map<string, Campaign>, seenValid: Set<string>): EnrichedRedemption {
  const t = parseLocal(r.timestamp_local);
  const c = campaigns.get(r.campaign_id);
  const flags: FlagCode[] = [];
  let counted = false;
  let eligible: number | null = null;
  let discount: number | null = null;

  if (!c) flags.push("unknown_campaign");
  else if (c.merchant_id !== r.merchant_id) flags.push("merchant_mismatch");

  if (r.status === "duplicate") flags.push("not_counted_duplicate");
  else if (r.status === "invalid") flags.push("not_counted_invalid");
  else if (r.status !== "valid") flags.push("unknown_status");
  else if (c && c.merchant_id === r.merchant_id) {
    const key = r.campaign_id + "|" + r.redemption_code;
    if (seenValid.has(key)) flags.push("repeat_valid_code");
    else {
      seenValid.add(key);
      counted = true;
      if (r.basket_value_try === null) flags.push("missing_basket");
      else {
        eligible = eligibleBasket(r.basket_value_try);
        const raw = (eligible ?? 0) * c.discount_pct;
        discount = recordedDiscount(eligible, c.discount_pct);
        if (r.basket_value_try > FINANCIAL_RULES.maxEligibleBasketTry) flags.push("basket_capped");
        if (raw > FINANCIAL_RULES.maxDiscountPerRedemptionTry) flags.push("discount_capped");
        if (c.min_spend_try !== null && r.basket_value_try < c.min_spend_try) flags.push("below_min_spend");
      }
      if (t) {
        if (t.date < c.valid_from || t.date > c.valid_until) flags.push("outside_dates");
        const w = parseWindow(c.eligible_window);
        const mins = t.hour * 60 + t.minute;
        if (w && (!w.days.includes(t.weekday) || mins < w.startMin || mins > w.endMin)) flags.push("outside_window");
      }
    }
  }
  if (counted) flags.unshift("counted");
  return {
    ...r,
    date: t?.date ?? "",
    hour: t?.hour ?? -1,
    weekday: t?.weekday ?? -1,
    counted,
    eligible_basket: eligible,
    recorded_discount: discount,
    flags,
  };
}

export interface Filters {
  merchantId: string; // "all" or id
  campaignId: string; // "all" or id
  from: string; // YYYY-MM-DD inclusive, "" = open
  to: string;
}

export function inScope(e: { merchant_id: string; campaign_id: string }, f: Pick<Filters, "merchantId" | "campaignId">) {
  return (f.merchantId === "all" || e.merchant_id === f.merchantId) && (f.campaignId === "all" || e.campaign_id === f.campaignId);
}

export function filterEvents(events: EnrichedRedemption[], f: Filters) {
  return events.filter((e) => inScope(e, f) && (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to));
}

export function scopedCampaigns(campaigns: Campaign[], f: Pick<Filters, "merchantId" | "campaignId">) {
  return campaigns.filter((c) => inScope(c, f));
}

export interface PeriodSummary {
  valid: number;
  duplicate: number;
  invalid: number;
  repeatValid: number;
  unknownStatus: number;
  eligibleBasket: number;
  discount: number;
  missingBasket: number;
  belowMinSpend: number;
  outsideWindow: number;
  maxCapacity: number;
  lifetimeUsed: number;
  remaining: number;
  capacityPct: number; // 0..1+
}

export function summarize(periodEvents: EnrichedRedemption[], allEvents: EnrichedRedemption[], campaigns: Campaign[]): PeriodSummary {
  const ids = new Set(campaigns.map((c) => c.campaign_id));
  const counted = periodEvents.filter((e) => e.counted);
  const lifetimeUsed = allEvents.filter((e) => e.counted && ids.has(e.campaign_id)).length;
  const maxCapacity = campaigns.reduce((s, c) => s + c.redemption_cap, 0);
  const remaining = campaigns.reduce((s, c) => s + capacityFor(c, allEvents).remaining, 0);
  return {
    valid: counted.length,
    duplicate: periodEvents.filter((e) => e.status === "duplicate").length,
    invalid: periodEvents.filter((e) => e.status === "invalid").length,
    repeatValid: periodEvents.filter((e) => e.flags.includes("repeat_valid_code")).length,
    unknownStatus: periodEvents.filter((e) => e.flags.includes("unknown_status")).length,
    eligibleBasket: round2(counted.reduce((s, e) => s + (e.eligible_basket ?? 0), 0)),
    discount: round2(counted.reduce((s, e) => s + (e.recorded_discount ?? 0), 0)),
    missingBasket: counted.filter((e) => e.flags.includes("missing_basket")).length,
    belowMinSpend: counted.filter((e) => e.flags.includes("below_min_spend")).length,
    outsideWindow: counted.filter((e) => e.flags.includes("outside_window")).length,
    maxCapacity,
    lifetimeUsed,
    remaining,
    capacityPct: maxCapacity ? lifetimeUsed / maxCapacity : 0,
  };
}

export function capacityFor(c: Campaign, allEvents: EnrichedRedemption[]) {
  const used = allEvents.filter((e) => e.counted && e.campaign_id === c.campaign_id).length;
  return {
    used,
    cap: c.redemption_cap,
    remaining: Math.max(0, c.redemption_cap - used),
    pct: c.redemption_cap ? used / c.redemption_cap : 0,
    overCap: used > c.redemption_cap,
  };
}

export function byDay(events: EnrichedRedemption[], from?: string, to?: string) {
  const map = new Map<string, { date: string; valid: number; duplicate: number; invalid: number; discount: number }>();
  const dates = new Set(events.map((e) => e.date).filter(Boolean));
  if (from && to && from <= to) {
    for (let d = from; d <= to; d = addDays(d, 1)) dates.add(d);
  }
  [...dates].sort().forEach((d) => map.set(d, { date: d, valid: 0, duplicate: 0, invalid: 0, discount: 0 }));
  for (const e of events) {
    const row = map.get(e.date);
    if (!row) continue;
    if (e.counted) {
      row.valid++;
      row.discount = round2(row.discount + (e.recorded_discount ?? 0));
    } else if (e.status === "duplicate") row.duplicate++;
    else if (e.status === "invalid") row.invalid++;
  }
  return [...map.values()].map((r) => ({ ...r, label: `${WEEKDAY_NAMES[parseLocal(r.date + " 00:00")!.weekday]!.slice(0, 3)} ${r.date.slice(5)}` }));
}

export function byHour(events: EnrichedRedemption[]) {
  const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, "0")}:00`, valid: 0, duplicate: 0, invalid: 0 }));
  for (const e of events) {
    if (e.hour < 0) continue;
    const row = rows[e.hour]!;
    if (e.counted) row.valid++;
    else if (e.status === "duplicate") row.duplicate++;
    else if (e.status === "invalid") row.invalid++;
  }
  return rows;
}

export function trimHours<T extends { valid: number; duplicate: number; invalid: number; hour: number }>(rows: T[]) {
  const active = rows.filter((r) => r.valid + r.duplicate + r.invalid > 0);
  if (!active.length) return rows.slice(8, 22);
  const lo = Math.max(0, Math.min(...active.map((r) => r.hour)) - 1);
  const hi = Math.min(23, Math.max(...active.map((r) => r.hour)) + 1);
  return rows.slice(lo, hi + 1);
}

export function addDays(d: string, n: number) {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return t.toISOString().slice(0, 10);
}

export interface Warning {
  level: "error" | "warning" | "info";
  message: string;
}

export function dataWarnings(ds: Dataset, events: EnrichedRedemption[], campaigns: Campaign[], period: EnrichedRedemption[]): Warning[] {
  const w: Warning[] = [];
  const ids = new Set(campaigns.map((c) => c.campaign_id));
  const merchants = new Set(ds.merchants.map((m) => m.merchant_id));
  for (const c of campaigns) {
    const cap = capacityFor(c, events);
    if (cap.overCap) w.push({ level: "error", message: `${c.campaign_id}: ${cap.used} accepted uses exceed the redemption cap of ${cap.cap}.` });
    if (!merchants.has(c.merchant_id)) w.push({ level: "warning", message: `${c.campaign_id}: merchant ${c.merchant_id} has no merchant profile.` });
    if (c.budget_try === null) w.push({ level: "warning", message: `${c.campaign_id}: budget is missing.` });
    else if (c.redemption_cap * FINANCIAL_RULES.maxDiscountPerRedemptionTry > c.budget_try)
      w.push({
        level: "warning",
        message: `${c.campaign_id}: maximum exposure (${c.redemption_cap} × TRY ${FINANCIAL_RULES.maxDiscountPerRedemptionTry} = TRY ${fmt(c.redemption_cap * FINANCIAL_RULES.maxDiscountPerRedemptionTry)}) exceeds budget TRY ${fmt(c.budget_try)}.`,
      });
    if (!parseWindow(c.eligible_window)) w.push({ level: "warning", message: `${c.campaign_id}: eligible window "${c.eligible_window}" could not be parsed.` });
    if (c.status.toUpperCase() !== "LIVE") w.push({ level: "info", message: `${c.campaign_id} status is ${c.status} — not live.` });
  }
  const scoped = events.filter((e) => ids.has(e.campaign_id) || !ds.campaigns.some((c) => c.campaign_id === e.campaign_id));
  const count = (f: FlagCode, list = period) => list.filter((e) => e.flags.includes(f) && (ids.has(e.campaign_id) || f === "unknown_campaign"));
  const push = (f: FlagCode, level: Warning["level"], text: (n: number, ex: string) => string) => {
    const list = count(f);
    if (list.length) w.push({ level, message: text(list.length, list.slice(0, 4).map((e) => e.event_id).join(", ")) });
  };
  push("repeat_valid_code", "error", (n, ex) => `${n} valid event(s) reuse a code already accepted in the same campaign — excluded from usage and cost (${ex}). Ledger left unchanged.`);
  push("missing_basket", "warning", (n, ex) => `${n} accepted redemption(s) have no basket value — excluded from proven cost; cost total is incomplete (${ex}).`);
  push("below_min_spend", "warning", (n, ex) => `${n} accepted redemption(s) are below the campaign minimum spend — flagged for reconciliation (${ex}).`);
  push("outside_window", "warning", (n, ex) => `${n} accepted redemption(s) fall outside the configured eligible window — flagged for review, status unchanged (${ex}).`);
  push("outside_dates", "warning", (n, ex) => `${n} accepted redemption(s) fall outside campaign valid dates (${ex}).`);
  push("unknown_status", "error", (n, ex) => `${n} event(s) have an unrecognised status (${ex}).`);
  push("merchant_mismatch", "error", (n, ex) => `${n} event(s) have a merchant_id that does not match the campaign (${ex}).`);
  const unknown = scoped.filter((e) => e.flags.includes("unknown_campaign"));
  if (unknown.length) w.push({ level: "error", message: `${unknown.length} event(s) reference an unknown campaign_id.` });
  return w;
}

export interface ReconciliationRow {
  campaign_id: string;
  merchant_id: string;
  referenceBasket: number;
  calculatedBasket: number;
  referenceDiscount: number;
  calculatedDiscount: number;
  referenceUses: number;
  calculatedUses: number;
  matches: boolean;
  explanation: string;
}

export function reconcile(ds: Dataset, events: EnrichedRedemption[]): ReconciliationRow[] {
  return ds.reference.map((ref) => {
    const evs = events.filter((e) => e.counted && e.campaign_id === ref.campaign_id);
    const calculatedBasket = round2(evs.reduce((s, e) => s + (e.eligible_basket ?? 0), 0));
    const calculatedDiscount = round2(evs.reduce((s, e) => s + (e.recorded_discount ?? 0), 0));
    const rawBasket = evs.reduce((s, e) => s + (e.basket_value_try ?? 0), 0);
    const capped = evs.filter((e) => e.flags.includes("basket_capped")).length;
    const matches = calculatedDiscount === ref.recorded_discount_try && calculatedBasket === ref.recorded_eligible_basket_try && evs.length === ref.verified_uses;
    let explanation = "Reference matches the provisional rules.";
    if (!matches) {
      explanation =
        rawBasket === ref.recorded_eligible_basket_try
          ? `Reference uses uncapped basket total (TRY ${fmt(rawBasket)}). ${capped} redemption(s) exceed the TRY 600 eligible cap, so the provisional rules give TRY ${fmt(calculatedBasket)} eligible and TRY ${fmt(calculatedDiscount)} discount.`
          : `Reference differs from ledger-derived values; review source workbook.`;
    }
    return {
      campaign_id: ref.campaign_id,
      merchant_id: ref.merchant_id,
      referenceBasket: ref.recorded_eligible_basket_try,
      calculatedBasket,
      referenceDiscount: ref.recorded_discount_try,
      calculatedDiscount,
      referenceUses: ref.verified_uses,
      calculatedUses: evs.length,
      matches,
      explanation,
    };
  });
}

export const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const fmtTry = (n: number) => `TRY ${fmt(n)}`;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
