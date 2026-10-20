import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import type { Warning } from "../calc";
import type { FlagCode } from "../models";
import { cn } from "@/lib/utils";

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string | undefined; tone?: "success" | "destructive" | "primary" | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Warnings({ items }: { items: Warning[] }) {
  if (!items.length) return <p className="text-sm text-success">No data-quality warnings in this scope.</p>;
  return (
    <ul className="space-y-2">
      {items.map((w, i) => {
        const Icon = w.level === "error" ? OctagonAlert : w.level === "warning" ? AlertTriangle : Info;
        return (
          <li key={i} className="flex gap-2 text-sm">
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", w.level === "info" ? "text-primary" : "text-destructive")} />
            <span className={w.level === "info" ? "text-muted-foreground" : "text-foreground"}>{w.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function CapacityBar({ used, cap, label }: { used: number; cap: number; label: string }) {
  const p = cap ? used / cap : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className={p > 1 ? "text-destructive" : "text-muted-foreground"}>
          {used} / {cap} used · {Math.max(0, cap - used)} left · {(p * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", p > 1 ? "bg-destructive" : p >= 0.8 ? "bg-primary-deep" : "bg-primary")} style={{ width: `${Math.min(100, p * 100)}%` }} />
      </div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" },
  labelStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--accent)", opacity: 0.4 },
};

export function ActivityChart({ data, x }: { data: Array<Record<string, unknown>>; x: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={x} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          <Bar dataKey="valid" name="Valid (counted)" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="duplicate" name="Duplicate" stackId="a" fill="var(--chart-5)" />
          <Bar dataKey="invalid" name="Invalid" stackId="a" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        status === "valid" && "bg-success/15 text-success",
        status === "duplicate" && "bg-muted text-muted-foreground",
        status === "invalid" && "bg-destructive/15 text-destructive",
        status === "DRAFT" && "bg-primary/15 text-primary",
      )}
    >
      {status}
    </span>
  );
}

export const FLAG_LABEL: Record<FlagCode, string> = {
  counted: "Counted",
  repeat_valid_code: "Repeat valid code — excluded",
  below_min_spend: "Below min spend",
  missing_basket: "Missing basket — cost unproven",
  outside_window: "Outside eligible window",
  outside_dates: "Outside campaign dates",
  basket_capped: "Basket capped at 600",
  discount_capped: "Discount capped at 60",
  unknown_status: "Unknown status",
  unknown_campaign: "Unknown campaign",
  merchant_mismatch: "Merchant mismatch",
  not_counted_duplicate: "Excluded: duplicate",
  not_counted_invalid: "Excluded: invalid",
};

export function Flags({ flags }: { flags: FlagCode[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            f === "counted" ? "bg-success/15 text-success" : f.startsWith("not_counted") ? "bg-muted text-muted-foreground" : f === "basket_capped" || f === "discount_capped" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
          )}
        >
          {FLAG_LABEL[f]}
        </span>
      ))}
    </div>
  );
}

export function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-full border border-input bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-full border border-input bg-secondary px-3 text-sm text-foreground [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-ring" />
    </label>
  );
}
