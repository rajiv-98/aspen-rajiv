<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All Aspen domain logic lives in `src/aspen/` (csv, models, calc, recommend, report, store); routes are thin views — keeps the module portable into the Workstream 4 admin.
- Calculations are pure functions over the imported ledger; never read figures from reference_weekly_summary — it is comparison-only.
- Data is processed client-side from bundled CSVs in `src/data/` or user-imported CSVs; no backend required for the MVP.
- Rules covered by `src/aspen/calc.test.ts`; run it after changing calc/report logic.
- Integration docs for the Aspen module live in INTEGRATION.md; keep it in sync with src/aspen exports.
