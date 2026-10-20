import { createFileRoute } from "@tanstack/react-router";
import { byDay, byHour, capacityFor, filterEvents, fmtTry, pct, summarize, trimHours } from "@/aspen/calc";
import { useScoped } from "@/aspen/useScoped";
import { ActivityChart, CapacityBar, Panel, Stat, StatusPill, Warnings } from "@/aspen/ui/widgets";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · Aspen Merchant Performance" },
      { name: "description", content: "Redemption, discount cost and capacity overview across Aspen merchant campaigns." },
      { property: "og:title", content: "Overview · Aspen Merchant Performance" },
      { property: "og:description", content: "Redemption, discount cost and capacity overview across Aspen merchant campaigns." },
    ],
  }),
  component: Overview,
});

function ReconciliationTable({ rows }: { rows: ReturnType<typeof useScoped>["recon"] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No reference figures for campaigns in this scope.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Campaign</th>
            <th>Uses ref / calc</th>
            <th>Eligible basket ref / calc</th>
            <th>Discount ref / calc</th>
            <th>Result</th>
            <th>Explanation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaign_id} className="border-t border-border align-top">
              <td className="py-2">{r.campaign_id}</td>
              <td>{r.referenceUses} / {r.calculatedUses}</td>
              <td>{fmtTry(r.referenceBasket)} / {fmtTry(r.calculatedBasket)}</td>
              <td>{fmtTry(r.referenceDiscount)} / {fmtTry(r.calculatedDiscount)}</td>
              <td className={r.matches ? "text-success" : "text-destructive"}>{r.matches ? "Matches" : "Differs"}</td>
              <td className="max-w-md text-muted-foreground">{r.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">Dashboard figures always use the provisional rules (eligible basket = min(basket, 600); discount = min(eligible × pct, 60)). Reference values are shown for comparison only and are never copied in.</p>
    </div>
  );
}

function Overview() {
  const { events, filters, campaigns, period, summary: s, warnings, recon } = useScoped();
  return (
    <>
      <div>
        <h1 className="text-3xl">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Activity for {filters.from || "start"} → {filters.to || "end"} (Istanbul local). Capacity figures are lifetime per campaign.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Valid redemptions" value={s.valid} hint="Period · unique valid codes" tone="success" />
        <Stat label="Duplicate attempts" value={s.duplicate} hint="Period · not counted" />
        <Stat label="Invalid attempts" value={s.invalid} hint="Period · not counted" tone={s.invalid ? "destructive" : undefined} />
        <Stat label="Eligible basket" value={fmtTry(s.eligibleBasket)} hint="Period · capped at 600 per use" />
        <Stat label="Discount cost" value={fmtTry(s.discount)} hint={s.missingBasket ? `${s.missingBasket} use(s) lack basket — incomplete` : "Period · capped at 60 per use"} tone="primary" />
        <Stat label="Max capacity" value={s.maxCapacity} hint={`${campaigns.length} campaign(s) in scope`} />
        <Stat label="Remaining capacity" value={s.remaining} hint="Lifetime" />
        <Stat label="Capacity used" value={pct(s.capacityPct)} hint={`Lifetime · ${s.lifetimeUsed} accepted`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Redemption activity by day">
          <ActivityChart data={byDay(period, filters.from, filters.to)} x="label" />
        </Panel>
        <Panel title="Redemption activity by hour">
          <ActivityChart data={trimHours(byHour(period))} x="label" />
        </Panel>
      </div>
      <Panel title="Merchant / campaign comparison">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Campaign</th>
                <th>Merchant</th>
                <th>Status</th>
                <th className="text-right">Valid</th>
                <th className="text-right">Dup.</th>
                <th className="text-right">Inv.</th>
                <th className="text-right">Eligible basket</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Lifetime used / cap</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const p = filterEvents(events, { ...filters, merchantId: c.merchant_id, campaignId: c.campaign_id });
                const cs = summarize(p, events, [c]);
                return (
                  <tr key={c.campaign_id} className="border-t border-border">
                    <td className="py-2">{c.campaign_id}</td>
                    <td>{c.merchant_id}</td>
                    <td><StatusPill status={c.status} /></td>
                    <td className="text-right">{cs.valid}</td>
                    <td className="text-right">{cs.duplicate}</td>
                    <td className="text-right">{cs.invalid}</td>
                    <td className="text-right">{fmtTry(cs.eligibleBasket)}</td>
                    <td className="text-right">{fmtTry(cs.discount)}</td>
                    <td className="text-right">{cs.lifetimeUsed} / {c.redemption_cap}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Campaign capacity (lifetime)">
          <div className="space-y-4">
            {campaigns.map((c) => {
              const k = capacityFor(c, events);
              return <CapacityBar key={c.campaign_id} label={`${c.campaign_id} · ${c.merchant_id}`} used={k.used} cap={k.cap} />;
            })}
          </div>
        </Panel>
        <Panel title="Data-quality warnings">
          <Warnings items={warnings} />
        </Panel>
      </div>
      <Panel title="Reconciliation vs. reference weekly summary">
        <ReconciliationTable rows={recon} />
      </Panel>
    </>
  );
}
