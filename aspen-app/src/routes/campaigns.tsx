import { createFileRoute } from "@tanstack/react-router";
import { WEEKDAY_NAMES, byDay, byHour, capacityFor, dataWarnings, filterEvents, fmtTry, pct, summarize, trimHours } from "@/aspen/calc";
import { recommend } from "@/aspen/recommend";
import { useAspen } from "@/aspen/store";
import { ActivityChart, CapacityBar, Panel, Stat, StatusPill, Warnings } from "@/aspen/ui/widgets";

export const Route = createFileRoute("/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaign Performance · Aspen" },
      { name: "description", content: "Per-campaign offer configuration, redemptions, capacity and data-quality checks." },
      { property: "og:title", content: "Campaign Performance · Aspen" },
      { property: "og:description", content: "Per-campaign offer configuration, redemptions, capacity and data-quality checks." },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const { dataset, events, filters, setFilters } = useAspen();
  const list = dataset.campaigns.filter((c) => filters.merchantId === "all" || c.merchant_id === filters.merchantId);
  const c = list.find((x) => x.campaign_id === filters.campaignId) ?? list[0];
  if (!c)
    return <Panel title="Campaign Performance"><p className="text-sm text-muted-foreground">No campaigns match the current merchant. Import data or change the merchant filter.</p></Panel>;
  const m = dataset.merchants.find((x) => x.merchant_id === c.merchant_id);
  const period = filterEvents(events, { ...filters, merchantId: c.merchant_id, campaignId: c.campaign_id });
  const s = summarize(period, events, [c]);
  const cap = capacityFor(c, events);
  const warnings = dataWarnings(dataset, events, [c], period);
  const counted = period.filter((e) => e.counted);
  const days = byDay(period, filters.from, filters.to);
  const topDay = [...days].sort((a, b) => b.valid - a.valid)[0];
  const hours = byHour(period);
  const topHour = [...hours].sort((a, b) => b.valid - a.valid)[0];
  const weekend = counted.filter((e) => e.weekday === 0 || e.weekday === 6).length;
  const rec = recommend(period, s);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{m?.business_name ?? c.merchant_id}</h1>
          <p className="text-sm text-muted-foreground">
            {c.campaign_id} · {m?.business_type ?? "No merchant profile"} · {m?.address_or_maps_link}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.map((x) => (
            <button key={x.campaign_id} onClick={() => setFilters({ campaignId: x.campaign_id })} className={x.campaign_id === c.campaign_id ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground" : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"}>
              {x.campaign_id}
            </button>
          ))}
        </div>
      </div>

      <Panel title="Configured offer">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
          {[
            ["Status", <StatusPill key="s" status={c.status} />],
            ["Goal", c.goal],
            ["Merchant goal", m?.primary_goal ?? "—"],
            ["Discount", `${Math.round(c.discount_pct * 100)}% (max TRY 60/use)`],
            ["Min spend", c.min_spend_try !== null ? fmtTry(c.min_spend_try) : "Missing"],
            ["Redemption cap", c.redemption_cap],
            ["Budget", c.budget_try !== null ? fmtTry(c.budget_try) : "Missing"],
            ["Valid dates", `${c.valid_from} → ${c.valid_until}`],
            ["Eligible times", c.eligible_window],
            ["Review notes", c.review_notes || "—"],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">This campaign is {c.status}; events in the ledger are synthetic test redemptions, not live activity.</p>
      </Panel>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Stat label="Valid" value={s.valid} tone="success" />
        <Stat label="Duplicates" value={s.duplicate} />
        <Stat label="Invalid" value={s.invalid} />
        <Stat label="Eligible basket" value={fmtTry(s.eligibleBasket)} />
        <Stat label="Discount cost" value={fmtTry(s.discount)} tone="primary" />
        <Stat label="Remaining uses" value={cap.remaining} hint={`Lifetime ${pct(cap.pct)} used`} />
      </div>

      <Panel title="Redemption capacity (lifetime)">
        <CapacityBar label={c.campaign_id} used={cap.used} cap={cap.cap} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Activity by day"><ActivityChart data={days} x="label" /></Panel>
        <Panel title="Activity by hour"><ActivityChart data={trimHours(hours)} x="label" /></Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Performance interpretation">
          {counted.length ? (
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
              <li>{counted.length} valid redemptions in the period; {s.duplicate} duplicate and {s.invalid} invalid attempts were rejected and do not consume capacity.</li>
              <li>Busiest day: {topDay?.label} ({topDay?.valid} valid). Busiest hour: {topHour?.label} ({topHour?.valid} valid).</li>
              <li>{weekend} of {counted.length} valid redemptions fell on a weekend.</li>
              <li>Average recorded discount per valid use: {fmtTry(counted.length ? Math.round((s.discount / counted.length) * 100) / 100 : 0)}.</li>
              <li>Suggested next step ({rec.source === "deterministic_fallback" ? "rule-based, not AI" : "AI"}): {rec.text}</li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No valid redemptions in the selected period.</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Anonymous redemption events cannot show unique customers, repeat visitors, footfall, incremental revenue or causal lift. Weekdays use {WEEKDAY_NAMES[1]}–{WEEKDAY_NAMES[0]} Istanbul local dates.</p>
        </Panel>
        <Panel title="Data-quality & calculation warnings"><Warnings items={warnings} /></Panel>
      </div>
    </>
  );
}
