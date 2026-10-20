// Deterministic recommendation layer. Produces exactly ONE recommendation from verified metrics.
// It never modifies a campaign. No AI model is configured in this build.
import { WEEKDAY_NAMES, pct, type PeriodSummary } from "./calc";
import type { EnrichedRedemption } from "./models";

export interface Recommendation {
  text: string;
  basis: string;
  source: "deterministic_fallback";
}

const part = (h: number) => (h < 12 ? "morning" : h < 17 ? "afternoon" : "evening");

export function recommend(period: EnrichedRedemption[], s: PeriodSummary): Recommendation {
  const base = { source: "deterministic_fallback" as const };
  const counted = period.filter((e) => e.counted);
  if (s.missingBasket > 0 || s.belowMinSpend > 0)
    return { ...base, text: `Reconcile the ${s.missingBasket + s.belowMinSpend} flagged redemption(s) (missing basket or below minimum spend) with the merchant before treating the period's discount cost as final.`, basis: "Data-quality flags on accepted redemptions." };
  if (s.outsideWindow > 0)
    return { ...base, text: `${s.outsideWindow} accepted redemption(s) fell outside the configured eligible window; confirm with the merchant whether redemption-time checks should be enforced before the campaign goes live.`, basis: "Accepted events outside eligible_window." };
  if (!counted.length)
    return { ...base, text: "No valid redemptions were recorded in this period; confirm the campaign setup and code distribution before drawing conclusions.", basis: "Zero valid redemptions in period." };
  if (s.capacityPct >= 0.8)
    return { ...base, text: `Lifetime capacity is ${pct(s.capacityPct)} used; review with the merchant whether the redemption cap should remain unchanged before remaining uses run out.`, basis: "Capacity used ≥ 80%." };
  const slot = new Map<string, number>();
  for (const e of counted) {
    const k = `${e.weekday}|${part(e.hour)}`;
    slot.set(k, (slot.get(k) ?? 0) + 1);
  }
  const [top, n] = [...slot.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const [wd, p] = top.split("|");
  const share = n / counted.length;
  if (share >= 0.25)
    return { ...base, text: `Redemptions were most concentrated on ${WEEKDAY_NAMES[Number(wd)]} ${p} (${n} of ${counted.length}); review whether the current offer window should remain unchanged or be adjusted after collecting more weekly data.`, basis: "Day/time-of-day concentration of valid redemptions." };
  return { ...base, text: `Valid redemptions were spread evenly across the period (${counted.length} total, ${pct(s.capacityPct)} of capacity used); keep the current configuration and reassess after another week of data.`, basis: "No dominant day/time slot." };
}
