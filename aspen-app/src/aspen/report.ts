// Report generation: buildWeeklyReport() (pure) + downloadReportPdf() (jsPDF, real file).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  byDay,
  byHour,
  capacityFor,
  dataWarnings,
  enrichRedemptions,
  filterEvents,
  fmt,
  pct,
  reconcile,
  summarize,
  type PeriodSummary,
  type Warning,
} from "./calc";
import type { Campaign, Dataset, Merchant } from "./models";
import { recommend, type Recommendation } from "./recommend";

export interface WeeklyReport {
  generatedAt: string;
  merchant: Merchant | undefined;
  campaign: Campaign;
  from: string;
  to: string;
  summary: PeriodSummary;
  capacity: ReturnType<typeof capacityFor>;
  daily: ReturnType<typeof byDay>;
  hourly: ReturnType<typeof byHour>;
  warnings: Warning[];
  recommendation: Recommendation;
  eventIds: string[];
}

export function buildWeeklyReport(ds: Dataset, campaignId: string, from: string, to: string): WeeklyReport {
  const campaign = ds.campaigns.find((c) => c.campaign_id === campaignId);
  if (!campaign) throw new Error(`Unknown campaign ${campaignId}`);
  const all = enrichRedemptions(ds);
  const f = { merchantId: campaign.merchant_id, campaignId, from, to };
  const period = filterEvents(all, f);
  const summary = summarize(period, all, [campaign]);
  const warnings = dataWarnings(ds, all, [campaign], period);
  const rec = reconcile(ds, all).find((r) => r.campaign_id === campaignId && !r.matches);
  if (rec)
    warnings.push({ level: "warning", message: `Reference summary reports TRY ${fmt(rec.referenceDiscount)} lifetime discount; provisional rules give TRY ${fmt(rec.calculatedDiscount)}. ${rec.explanation}` });
  warnings.push({ level: "info", message: "Anonymous redemption events cannot show unique customers, repeat visits, footfall, incremental revenue or campaign lift." });
  return {
    generatedAt: new Date().toISOString(),
    merchant: ds.merchants.find((m) => m.merchant_id === campaign.merchant_id),
    campaign,
    from,
    to,
    summary,
    capacity: capacityFor(campaign, all),
    daily: byDay(period, from, to),
    hourly: byHour(period).filter((h) => h.valid + h.duplicate + h.invalid > 0),
    warnings,
    recommendation: recommend(period, summary),
    eventIds: period.map((e) => e.event_id),
  };
}

const NAVY: [number, number, number] = [22, 33, 62];
const BLUE: [number, number, number] = [79, 124, 255];
const INK: [number, number, number] = [20, 24, 38];
const GREY: [number, number, number] = [95, 104, 128];

// jsPDF core fonts only cover WinAnsi; transliterate everything else so text never garbles.
const MAP: Record<string, string> = { "—": "-", "–": "-", "→": "->", "·": "|", "×": "x", "≥": ">=", "≤": "<=", "ş": "s", "Ş": "S", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I", "’": "'", "“": '"', "”": '"' };
export const pdfSafe = (v: string) => v.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, (c) => MAP[c] ?? "?");
const sanitize = <T,>(o: T): T => JSON.parse(JSON.stringify(o), (_k, v) => (typeof v === "string" ? pdfSafe(v) : v));

export function reportPdf(input: WeeklyReport): jsPDF {
  const r = sanitize(input);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 78, "F");
  doc.setTextColor(234, 237, 245);
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.text("Aspen", M, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Merchant Performance & Reporting - Weekly Report", M, 54);
  doc.setFontSize(9);
  doc.setTextColor(242, 109, 109);
  doc.text("DRAFT - SYNTHETIC DEMO DATA", W - M, 36, { align: "right" });
  doc.setTextColor(180, 188, 212);
  doc.text(`Generated ${r.generatedAt.slice(0, 16).replace("T", " ")} UTC`, W - M, 54, { align: "right" });

  let y = 104;
  doc.setTextColor(...INK);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text(r.merchant?.business_name ?? r.campaign.merchant_id, M, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GREY);
  doc.text(`${r.campaign.merchant_id} | Campaign ${r.campaign.campaign_id} | Status ${r.campaign.status} | Period ${r.from} to ${r.to} (Europe/Istanbul)`, M, y);
  y += 14;
  const offer = `Offer: ${Math.round(r.campaign.discount_pct * 100)}% off, min spend TRY ${fmt(r.campaign.min_spend_try ?? 0)}, ${r.campaign.eligible_window}, valid ${r.campaign.valid_from} to ${r.campaign.valid_until}. Goal: ${r.campaign.goal}. Caps: TRY 600 eligible basket, TRY 60 per redemption.`;
  const lines = doc.splitTextToSize(offer, W - 2 * M);
  doc.text(lines, M, y);
  y += lines.length * 12 + 6;

  const s = r.summary;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    headStyles: { fillColor: BLUE, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4 },
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Valid redemptions (period)", String(s.valid), "Lifetime capacity used", `${r.capacity.used} / ${r.capacity.cap} (${pct(r.capacity.pct)})`],
      ["Duplicate attempts", String(s.duplicate), "Remaining uses", String(r.capacity.remaining)],
      ["Invalid attempts", String(s.invalid), "Missing basket values", String(s.missingBasket)],
      ["Recorded eligible basket", `TRY ${fmt(s.eligibleBasket)}`, "Recorded discounts", `TRY ${fmt(s.discount)}`],
    ],
  });
  // @ts-expect-error lastAutoTable added by plugin
  y = doc.lastAutoTable.finalY + 14;

  const half = (W - 2 * M - 12) / 2;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: W - M - half },
    theme: "striped",
    headStyles: { fillColor: NAVY, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 3 },
    head: [["Day", "Valid", "Dup.", "Inv.", "Discount"]],
    body: r.daily.map((d) => [d.label, d.valid, d.duplicate, d.invalid, `TRY ${fmt(d.discount)}`]),
  });
  // @ts-expect-error plugin
  const yL = doc.lastAutoTable.finalY;
  autoTable(doc, {
    startY: y,
    margin: { left: M + half + 12, right: M },
    theme: "striped",
    headStyles: { fillColor: NAVY, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 3 },
    head: [["Hour", "Valid", "Dup.", "Inv."]],
    body: r.hourly.length ? r.hourly.map((h) => [h.label, h.valid, h.duplicate, h.invalid]) : [["No activity", "", "", ""]],
  });
  // @ts-expect-error plugin
  y = Math.max(yL, doc.lastAutoTable.finalY) + 14;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    headStyles: { textColor: INK, fontStyle: "bold", fontSize: 9.5 },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: INK },
    head: [["Data limitations & reconciliation"]],
    body: r.warnings.map((w) => [`[${w.level.toUpperCase()}] ${w.message}`]),
  });
  // @ts-expect-error plugin
  y = doc.lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    headStyles: { fillColor: BLUE, fontSize: 9.5 },
    styles: { fontSize: 9.5, cellPadding: 6 },
    head: [["Recommendation (deterministic rules - not AI-generated; does not change the campaign)"]],
    body: [[r.recommendation.text]],
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`Draft - Synthetic Demo Data | Aspen internal | Page ${i} of ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
  }
  return doc;
}

export const reportFilename = (r: WeeklyReport) => `aspen-report-${r.campaign.merchant_id}-${r.campaign.campaign_id}-${r.from}_${r.to}.pdf`;

export function reportPdfBlob(r: WeeklyReport): Blob {
  return new Blob([reportPdf(r).output("arraybuffer")], { type: "application/pdf" });
}

/** Call synchronously from a click handler (keeps user activation). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
