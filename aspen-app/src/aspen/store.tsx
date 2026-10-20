// Client-side data store: holds the imported dataset, enriched ledger and global filters.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { enrichRedemptions, type Filters } from "./calc";
import type { Dataset, EnrichedRedemption } from "./models";
import { loadSeedDataset } from "./seed";

interface Store {
  dataset: Dataset;
  events: EnrichedRedemption[];
  source: "bundled" | "imported";
  setDataset: (d: Dataset, source: "bundled" | "imported") => void;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
}

const Ctx = createContext<Store | null>(null);

export const DEFAULT_FILTERS: Filters = { merchantId: "all", campaignId: "all", from: "2026-10-12", to: "2026-10-18" };

export function AspenProvider({ children, initial }: { children: ReactNode; initial?: Dataset }) {
  const [dataset, setDs] = useState<Dataset>(() => initial ?? loadSeedDataset());
  const [source, setSource] = useState<"bundled" | "imported">("bundled");
  const [filters, setF] = useState<Filters>(DEFAULT_FILTERS);
  const events = useMemo(() => enrichRedemptions(dataset), [dataset]);
  const value = useMemo<Store>(
    () => ({
      dataset,
      events,
      source,
      setDataset: (d, s) => {
        setDs(d);
        setSource(s);
        setF((f) => ({ ...f, merchantId: "all", campaignId: "all" }));
      },
      filters,
      setFilters: (p) =>
        setF((f) => {
          const n = { ...f, ...p };
          if (p.merchantId !== undefined && p.campaignId === undefined) n.campaignId = "all";
          return n;
        }),
    }),
    [dataset, events, source, filters],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAspen() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAspen must be used inside <AspenProvider>");
  return c;
}
