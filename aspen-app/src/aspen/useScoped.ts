import { useMemo } from "react";
import { dataWarnings, filterEvents, reconcile, scopedCampaigns, summarize } from "./calc";
import { useAspen } from "./store";

/** Everything the dashboard needs for the current global filters. */
export function useScoped() {
  const { dataset, events, filters } = useAspen();
  return useMemo(() => {
    const campaigns = scopedCampaigns(dataset.campaigns, filters);
    const period = filterEvents(events, filters);
    const summary = summarize(period, events, campaigns);
    const warnings = dataWarnings(dataset, events, campaigns, period);
    const recon = reconcile(dataset, events).filter((r) => campaigns.some((c) => c.campaign_id === r.campaign_id));
    return { dataset, events, filters, campaigns, period, summary, warnings, recon };
  }, [dataset, events, filters]);
}
