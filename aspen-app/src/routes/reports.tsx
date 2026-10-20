import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtTry, pct } from "@/aspen/calc";
import { buildWeeklyReport, downloadBlob, reportFilename, reportPdfBlob, type WeeklyReport } from "@/aspen/report";
import { useAspen } from "@/aspen/store";
import { ActivityChart, CapacityBar, FieldDate, FieldSelect, Panel, Stat, Warnings } from "@/aspen/ui/widgets";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Weekly Reports · Aspen" },
      { name: "description", content: "Generate merchant-specific weekly performance reports and download them as PDF." },
      { property: "og:title", content: "Weekly Reports · Aspen" },
      { property: "og:description", content: "Generate merchant-specific weekly performance reports and download them as PDF." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { dataset, filters } = useAspen();
  const [merchantId, setMerchant] = useState(filters.merchantId !== "all" ? filters.merchantId : dataset.merchants[0]?.merchant_id ?? "");
  const camps = dataset.campaigns.filter((c) => c.merchant_id === merchantId);
  const [campaignId, setCampaign] = useState(filters.campaignId !== "all" ? filters.campaignId : camps[0]?.campaign_id ?? "");
  const [from, setFrom] = useState(filters.from || "2026-10-12");
  const [to, setTo] = useState(filters.to || "2026-10-18");
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<Blob | null>(null);
  const effectiveCampaign = camps.some((c) => c.campaign_id === campaignId) ? campaignId : camps[0]?.campaign_id ?? "";

  const generate = () => {
    setError("");
    if (!effectiveCampaign) return setError("This merchant has no campaign to report on.");
    if (!from || !to || from > to) return setError("Choose a valid start and end date.");
    const r = buildWeeklyReport(dataset, effectiveCampaign, from, to);
    setReport(r);
    try {
      setPdf(reportPdfBlob(r));
    } catch (e) {
      setPdf(null);
      setError(`PDF could not be created: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-3xl">Weekly Reports</h1>
        <p className="text-sm text-muted-foreground">Merchant-specific report built only from that campaign's ledger events.</p>
      </div>
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <FieldSelect label="Merchant" value={merchantId} onChange={(v) => { setMerchant(v); setReport(null); setPdf(null); }} options={dataset.merchants.map((m) => ({ value: m.merchant_id, label: `${m.merchant_id} · ${m.business_name}` }))} />
          <FieldSelect label="Campaign" value={effectiveCampaign} onChange={(v) => { setCampaign(v); setReport(null); setPdf(null); }} options={camps.length ? camps.map((c) => ({ value: c.campaign_id, label: c.campaign_id })) : [{ value: "", label: "No campaigns" }]} />
          <FieldDate label="Reporting start" value={from} onChange={(v) => { setFrom(v); setReport(null); setPdf(null); }} />
          <FieldDate label="Reporting end" value={to} onChange={(v) => { setTo(v); setReport(null); setPdf(null); }} />
          <Button onClick={generate}><FileText /> Generate Weekly Report</Button>
          {report && pdf && <Button variant="outline" onClick={() => downloadBlob(pdf, reportFilename(report))}><Download /> Download PDF</Button>}
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </Panel>
      {report && <ReportView r={report} />}
    </>
  );
}

function ReportView({ r }: { r: WeeklyReport }) {
  const s = r.summary;
  return (
    <section className="space-y-6 rounded-2xl border border-primary/30 bg-card/40 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="font-display text-sm text-primary">Aspen · Weekly Merchant Report</div>
          <h2 className="text-2xl">{r.merchant?.business_name ?? r.campaign.merchant_id}</h2>
          <p className="text-sm text-muted-foreground">{r.campaign.campaign_id} · {r.from} → {r.to} · Status {r.campaign.status}</p>
        </div>
        <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs text-destructive">Draft — Synthetic Demo Data</span>
      </div>
      <p className="text-sm text-foreground">
        Offer: {Math.round(r.campaign.discount_pct * 100)}% off with minimum spend {fmtTry(r.campaign.min_spend_try ?? 0)}, {r.campaign.eligible_window}, valid {r.campaign.valid_from} to {r.campaign.valid_until}. Goal: {r.campaign.goal}.
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Valid (period)" value={s.valid} tone="success" />
        <Stat label="Duplicate / invalid" value={`${s.duplicate} / ${s.invalid}`} />
        <Stat label="Eligible basket" value={fmtTry(s.eligibleBasket)} />
        <Stat label="Recorded discounts" value={fmtTry(s.discount)} tone="primary" />
        <Stat label="Lifetime used" value={pct(r.capacity.pct)} hint={`${r.capacity.remaining} remaining of ${r.capacity.cap}`} />
      </div>
      <CapacityBar label="Lifetime capacity" used={r.capacity.used} cap={r.capacity.cap} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Daily breakdown"><ActivityChart data={r.daily} x="label" /></Panel>
        <Panel title="Hourly breakdown"><ActivityChart data={r.hourly} x="label" /></Panel>
      </div>
      <Panel title="Data limitations & reconciliation"><Warnings items={r.warnings} /></Panel>
      <Panel title="Recommendation">
        <p className="text-foreground">{r.recommendation.text}</p>
        <p className="mt-2 text-xs text-muted-foreground">Generated by deterministic rules ({r.recommendation.basis}) — no AI model is configured. Recommendations never change a campaign automatically.</p>
      </Panel>
    </section>
  );
}
