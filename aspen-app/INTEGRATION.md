# Aspen | Merchant Performance & Reporting — Integration guide (Workstream 3)

All logic is client-side and lives in `src/aspen/`. No backend, auth or paid API is required.

## Modules
| Module | Purpose |
|---|---|
| `csv.ts` | `parseCsv`, `validateColumns(kind, text)`, `toMerchants/toCampaigns/toRedemptions/toReference` |
| `models.ts` | Types (`Merchant`, `Campaign`, `Redemption`, `EnrichedRedemption`, `Dataset`) and `FINANCIAL_RULES` |
| `calc.ts` | Pure aggregation & finance: `enrichRedemptions`, `filterEvents`, `summarize`, `capacityFor`, `byDay`, `byHour`, `dataWarnings`, `reconcile` |
| `recommend.ts` | Deterministic single recommendation (`source: "deterministic_fallback"`). No AI configured. Never modifies campaigns. |
| `report.ts` | `buildWeeklyReport(dataset, campaignId, from, to)` → `WeeklyReport`; `reportPdf(report)` → jsPDF doc; `downloadReportPdf(report)` |
| `store.tsx` | `<AspenProvider initial?={dataset}>` + `useAspen()` (dataset, enriched events, global filters, import) |
| `ui/` | `Shell` (sidebar + filters + Demo Data badge), `ImportPanel`, chart/stat widgets |
| `src/routes/{index,campaigns,ledger,reports}.tsx` | The four pages |

## Embedding
Wrap pages in `<AspenProvider initial={yourDataset}>`. Pass your own `Dataset` to skip the bundled CSVs in `src/data/`.

## Data schema (shared field names)
Redemptions: `event_id, campaign_id, merchant_id, redemption_code, timestamp_local, status, basket_value_try, data_status, notes`.
- `timestamp_local` is naive Europe/Istanbul time ("YYYY-MM-DD HH:mm:ss"); it is parsed as text, never shifted through UTC.
- `status` ∈ valid | duplicate | invalid. `discount_pct` is a decimal (0.10 = 10%).

## Calculation rules
- Counted = `status="valid"`, campaign known, merchant matches, first occurrence of that `redemption_code` within the campaign (repeats are flagged `repeat_valid_code`, ledger unchanged).
- `eligible_basket = min(basket_value_try, 600)`; `recorded_discount = min(eligible × discount_pct, 60)`.
- Missing basket → counted for usage, excluded from cost, warning raised.
- Below `min_spend_try` / outside `eligible_window` / outside valid dates → flagged, status unchanged.
- `remaining = max(0, cap − lifetime counted)`; capacity is always lifetime, period metrics follow the date filter.
- `reference_weekly_summary.csv` is comparison-only (Reconciliation section).

## Tests
`bunx vitest run src/aspen/calc.test.ts` — acceptance counts, caps, reconciliation, dedup, date filtering, M002 report isolation.
