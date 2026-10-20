import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCampaigns, toMerchants, toRedemptions, toReference, validateColumns, type FileKind } from "../csv";
import { loadSeedDataset } from "../seed";
import { useAspen } from "../store";

const KINDS: { kind: FileKind; label: string; required: boolean }[] = [
  { kind: "merchants", label: "merchants.csv", required: true },
  { kind: "campaigns", label: "campaigns.csv", required: true },
  { kind: "redemptions", label: "redemptions.csv", required: true },
  { kind: "reference", label: "reference_weekly_summary.csv (optional)", required: false },
];

export function ImportPanel() {
  const { dataset, source, setDataset } = useAspen();
  const [texts, setTexts] = useState<Partial<Record<FileKind, string>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState<string>("");

  const read = async (kind: FileKind, file: File | undefined) => {
    if (!file) return;
    const t = await file.text();
    setTexts((s) => ({ ...s, [kind]: t }));
    setOk("");
  };

  const apply = () => {
    const errs: string[] = [];
    for (const k of KINDS) {
      const t = texts[k.kind];
      if (!t) {
        if (k.required) errs.push(`${k.label}: not selected.`);
        continue;
      }
      const missing = validateColumns(k.kind, t);
      if (missing.length) errs.push(`${k.label}: missing column(s) ${missing.join(", ")}.`);
    }
    setErrors(errs);
    if (errs.length) return setOk("");
    const d = {
      merchants: toMerchants(texts.merchants!),
      campaigns: toCampaigns(texts.campaigns!),
      redemptions: toRedemptions(texts.redemptions!),
      reference: texts.reference ? toReference(texts.reference) : [],
    };
    setDataset(d, "imported");
    setOk(`Imported ${d.merchants.length} merchants, ${d.campaigns.length} campaigns, ${d.redemptions.length} redemption events.`);
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Currently loaded: <span className="text-foreground">{source === "bundled" ? "supplied synthetic CSVs" : "imported CSVs"}</span> — {dataset.merchants.length} merchants, {dataset.campaigns.length} campaigns, {dataset.redemptions.length} events. Processing stays in your browser.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k) => (
          <label key={k.kind} className="flex flex-col gap-1 rounded-xl border border-border bg-secondary p-3 text-xs text-muted-foreground">
            <span className="text-foreground">{k.label}</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => read(k.kind, e.target.files?.[0])} className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground" />
            {texts[k.kind] && <span className="text-success">Selected</span>}
          </label>
        ))}
      </div>
      {errors.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {ok && <p className="text-success">{ok}</p>}
      <div className="flex gap-2">
        <Button onClick={apply}>
          <Upload /> Validate & import
        </Button>
        <Button variant="outline" onClick={() => { setDataset(loadSeedDataset(), "bundled"); setOk("Restored supplied synthetic CSVs."); setErrors([]); }}>
          Reset to supplied data
        </Button>
      </div>
    </div>
  );
}
