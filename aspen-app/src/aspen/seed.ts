// Bundled supplied CSVs (synthetic demo data). Loaded verbatim — no generated records.
import merchantsCsv from "@/data/merchants.csv?raw";
import campaignsCsv from "@/data/campaigns.csv?raw";
import redemptionsCsv from "@/data/redemptions.csv?raw";
import referenceCsv from "@/data/reference_weekly_summary.csv?raw";
import { toCampaigns, toMerchants, toRedemptions, toReference } from "./csv";
import type { Dataset } from "./models";

export const SEED_CSV = { merchants: merchantsCsv, campaigns: campaignsCsv, redemptions: redemptionsCsv, reference: referenceCsv };

export function loadSeedDataset(): Dataset {
  return {
    merchants: toMerchants(merchantsCsv),
    campaigns: toCampaigns(campaignsCsv),
    redemptions: toRedemptions(redemptionsCsv),
    reference: toReference(referenceCsv),
  };
}
