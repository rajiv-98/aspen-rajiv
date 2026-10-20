import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpDown } from "lucide-react";
import { filterEvents, fmt } from "@/aspen/calc";
import type { EnrichedRedemption } from "@/aspen/models";
import { useAspen } from "@/aspen/store";
import { FieldSelect, Flags, Panel, StatusPill } from "@/aspen/ui/widgets";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Redemption Ledger · Aspen" },
      { name: "description", content: "Auditable ledger of every imported redemption event with calculated values and flags." },
      { property: "og:title", content: "Redemption Ledger · Aspen" },
      { property: "og:description", content: "Auditable ledger of every imported redemption event with calculated values and flags." },
    ],
  }),
  component: LedgerPage,
});

type Key = keyof Pick<EnrichedRedemption, "event_id" | "merchant_id" | "campaign_id" | "redemption_code" | "timestamp_local" | "status" | "basket_value_try" | "eligible_basket" | "recorded_discount">;

function LedgerPage() {
  const { dataset, events, filters } = useAspen();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [inclusion, setInclusion] = useState("all");
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "timestamp_local", dir: 1 });
  const names = new Map(dataset.merchants.map((m) => [m.merchant_id, m.business_name]));

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    return filterEvents(events, filters)
      .filter((e) => status === "all" || e.status === status)
      .filter((e) => inclusion === "all" || (inclusion === "counted" ? e.counted : !e.counted))
      .filter((e) => !ql || [e.event_id, e.redemption_code, e.campaign_id, e.merchant_id, e.notes, names.get(e.merchant_id) ?? ""].some((v) => v.toLowerCase().includes(ql)))
      .sort((a, b) => {
        const x = a[sort.k] ?? -Infinity;
        const y = b[sort.k] ?? -Infinity;
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [events, filters, status, inclusion, q, sort, names]);

  const H = ({ k, label, right }: { k: Key; label: string; right?: boolean }) => (
    <th className={right ? "text-right" : ""}>
      <button className="inline-flex items-center gap-1 py-2 uppercase hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : 1 }))}>
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <>
      <div>
        <h1 className="text-3xl">Redemption Ledger</h1>
        <p className="text-sm text-muted-foreground">Source records are shown unmodified; calculated columns and flags explain whether each event is counted. Merchant, campaign and date use the filters above.</p>
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Search
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Event, code, merchant…" className="h-9 w-64 rounded-full border border-input bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <FieldSelect label="Status" value={status} onChange={setStatus} options={["all", "valid", "duplicate", "invalid"].map((v) => ({ value: v, label: v === "all" ? "All statuses" : v }))} />
          <FieldSelect label="Inclusion" value={inclusion} onChange={setInclusion} options={[{ value: "all", label: "All events" }, { value: "counted", label: "Counted only" }, { value: "excluded", label: "Excluded only" }]} />
          <div className="ml-auto text-sm text-muted-foreground">
            {rows.length} events · {rows.filter((r) => r.counted).length} counted · {rows.filter((r) => !r.counted).length} excluded
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <H k="event_id" label="Event" />
                <H k="merchant_id" label="Merchant" />
                <H k="campaign_id" label="Campaign" />
                <H k="redemption_code" label="Code" />
                <H k="timestamp_local" label="Istanbul local time" />
                <H k="status" label="Status" />
                <H k="basket_value_try" label="Basket" right />
                <H k="eligible_basket" label="Eligible" right />
                <H k="recorded_discount" label="Discount" right />
                <th className="py-2 uppercase">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.event_id + e.timestamp_local} className="border-t border-border align-top" title={e.notes}>
                  <td className="py-2 font-medium">{e.event_id}</td>
                  <td>{e.merchant_id} <span className="text-muted-foreground">{names.get(e.merchant_id)}</span></td>
                  <td>{e.campaign_id}</td>
                  <td className="font-mono text-xs">{e.redemption_code}</td>
                  <td>{e.timestamp_local}</td>
                  <td><StatusPill status={e.status} /></td>
                  <td className="text-right">{e.basket_value_try === null ? <span className="text-destructive">missing</span> : fmt(e.basket_value_try)}</td>
                  <td className="text-right">{e.eligible_basket === null ? "—" : fmt(e.eligible_basket)}</td>
                  <td className="text-right">{e.recorded_discount === null ? "—" : fmt(e.recorded_discount)}</td>
                  <td><Flags flags={e.flags} /></td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">No events match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
