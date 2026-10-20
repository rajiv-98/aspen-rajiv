import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText, LayoutDashboard, ListOrdered, PanelLeftClose, PanelLeftOpen, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAspen } from "../store";
import { FieldDate, FieldSelect } from "./widgets";
import { ImportPanel } from "./ImportPanel";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/campaigns", label: "Campaign Performance", icon: BarChart3 },
  { to: "/ledger", label: "Redemption Ledger", icon: ListOrdered },
  { to: "/reports", label: "Weekly Reports", icon: FileText },
] as const;

export function GlobalFilters() {
  const { dataset, filters, setFilters } = useAspen();
  const camps = dataset.campaigns.filter((c) => filters.merchantId === "all" || c.merchant_id === filters.merchantId);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FieldSelect
        label="Merchant"
        value={filters.merchantId}
        onChange={(v) => setFilters({ merchantId: v })}
        options={[{ value: "all", label: "All Merchants" }, ...dataset.merchants.map((m) => ({ value: m.merchant_id, label: `${m.merchant_id} · ${m.business_name}` }))]}
      />
      <FieldSelect label="Campaign" value={filters.campaignId} onChange={(v) => setFilters({ campaignId: v })} options={[{ value: "all", label: "All Campaigns" }, ...camps.map((c) => ({ value: c.campaign_id, label: `${c.campaign_id} (${c.status})` }))]} />
      <FieldDate label="From" value={filters.from} onChange={(v) => setFilters({ from: v })} />
      <FieldDate label="To" value={filters.to} onChange={(v) => setFilters({ to: v })} />
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { source } = useAspen();
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className={cn("sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all", open ? "w-64" : "w-16")}>
        <div className="flex h-16 items-center justify-between px-4">
          {open && (
            <div>
              <div className="font-display text-xl font-bold text-foreground">Aspen</div>
              <div className="text-[11px] text-muted-foreground">Merchant Performance & Reporting</div>
            </div>
          )}
          <button onClick={() => setOpen(!open)} aria-label="Toggle sidebar" className="rounded-full p-1.5 text-muted-foreground hover:bg-sidebar-accent">
            {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>
        <nav className="mt-4 flex flex-col gap-1 px-2">
          {NAV.map((n) => {
            const active = path === n.to;
            return (
              <Link key={n.to} to={n.to} title={n.label} className={cn("flex items-center gap-3 rounded-full px-3 py-2 text-sm", active ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground")}>
                <n.icon className="h-4 w-4 shrink-0" />
                {open && n.label}
              </Link>
            );
          })}
        </nav>
        {open && <div className="mt-auto p-4 text-[11px] text-muted-foreground">Internal admin tool · Workstream 3 · Times shown in Europe/Istanbul local time.</div>}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-end justify-between gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
          <GlobalFilters />
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">Demo Data · Synthetic{source === "imported" ? " (imported)" : ""}</span>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Database /> Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-display">Import CSV data</DialogTitle>
                </DialogHeader>
                <ImportPanel />
              </DialogContent>
            </Dialog>
          </div>
        </header>
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
