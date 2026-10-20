import { describe, expect, it } from "vitest";
import { enrichRedemptions, filterEvents, reconcile, recordedDiscount, eligibleBasket, summarize, capacityFor } from "./calc";
import { loadSeedDataset } from "./seed";
import { buildWeeklyReport } from "./report";
import type { Dataset } from "./models";

const ds = loadSeedDataset();
const all = enrichRedemptions(ds);
const camp = (id: string) => ds.campaigns.find((c) => c.campaign_id === id)!;
const life = (id: string) => summarize(filterEvents(all, { merchantId: "all", campaignId: id, from: "", to: "" }), all, [camp(id)]);

describe("acceptance counts", () => {
  it.each([
    ["C-M001-001", 22, 2, 1, 28, 50],
    ["C-M002-001", 17, 2, 1, 28, 45],
    ["C-M003-001", 11, 2, 1, 14, 25],
  ])("%s", (id, valid, dup, inv, rem, cap) => {
    const s = life(id);
    expect([s.valid, s.duplicate, s.invalid, s.remaining, s.maxCapacity]).toEqual([valid, dup, inv, rem, cap]);
  });
});

describe("financial rules", () => {
  it("caps basket at 600 and discount at 60", () => {
    expect(eligibleBasket(650)).toBe(600);
    expect(recordedDiscount(600, 0.15)).toBe(60);
    expect(recordedDiscount(400, 0.1)).toBe(40);
    expect(eligibleBasket(null)).toBeNull();
  });
  it("reconciles M001 to the reference and flags M002/M003", () => {
    const r = Object.fromEntries(reconcile(ds, all).map((x) => [x.campaign_id, x]));
    expect(r["C-M001-001"]!.calculatedDiscount).toBe(1035);
    expect(r["C-M001-001"]!.matches).toBe(true);
    expect(r["C-M002-001"]!.calculatedDiscount).toBe(950);
    expect(r["C-M002-001"]!.matches).toBe(false);
    expect(r["C-M003-001"]!.calculatedDiscount).toBe(660);
    expect(r["C-M003-001"]!.matches).toBe(false);
  });
});

describe("dedup and filters", () => {
  it("repeated valid code counts once and is flagged", () => {
    const d: Dataset = { ...ds, redemptions: [...ds.redemptions, { ...ds.redemptions[0]!, event_id: "X1", timestamp_local: "2026-10-19 14:30:00" }] };
    const e = enrichRedemptions(d);
    expect(capacityFor(camp("C-M001-001"), e).used).toBe(22);
    expect(e.find((x) => x.event_id === "X1")!.flags).toContain("repeat_valid_code");
  });
  it("date filter limits period activity but not lifetime capacity", () => {
    const p = filterEvents(all, { merchantId: "M001", campaignId: "all", from: "2026-10-12", to: "2026-10-12" });
    const s = summarize(p, all, [camp("C-M001-001")]);
    expect(s.valid).toBe(4);
    expect(s.remaining).toBe(28);
  });
  it("M002 report contains only M002 events", () => {
    const r = buildWeeklyReport(ds, "C-M002-001", "2026-10-12", "2026-10-18");
    const ids = new Set(r.eventIds);
    expect(all.filter((e) => ids.has(e.event_id)).every((e) => e.merchant_id === "M002")).toBe(true);
    expect(r.summary.valid).toBe(17);
    expect(typeof r.recommendation.text).toBe("string");
  });
});

describe("PDF", () => {
  it("M002 PDF is a real PDF with M002 data and exactly one recommendation", async () => {
    const { reportPdf } = await import("./report");
    const r = buildWeeklyReport(ds, "C-M002-001", "2026-10-12", "2026-10-18");
    const raw = reportPdf(r).output();
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toContain("Beytepe Table");
    expect(raw).toContain("TRY 950");
    expect(raw).not.toContain("Incek Corner");
    expect(raw.split("(Recommendation").length - 1).toBe(1);
  });
});
