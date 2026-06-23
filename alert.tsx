import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, Package, Users, Warehouse, RefreshCw,
  Download, Printer, TrendingUp, AlertTriangle,
  CheckCircle, Database, X, Loader2, FileSpreadsheet,
  Radio, ArrowUpRight, ArrowDownRight, Filter,
} from "lucide-react";
import Papa from "papaparse";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalesRow {
  date: Date | null;
  invoice: string;
  customer: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  revenue: number;
  product: string;
  productId: string;
  mainProduct: string;
}

interface InventoryRow {
  productName: string;
  sku: string;
  openingStock: number;
  received: number;
  shipped: number;
  endPeriodShipped: number;
  endPeriodActual: number;
  available: number;
}

interface SheetConfig {
  sheetId: string;
}

type PageId = "overview" | "product" | "customer" | "inventory";

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4", "#F97316", "#EC4899"];
const NAVY = "#0F2744";

const NAV_ITEMS = [
  { id: "overview" as PageId, label: "Sales Overview", icon: LayoutDashboard },
  { id: "product" as PageId, label: "Product Analysis", icon: Package },
  { id: "customer" as PageId, label: "Customer Analysis", icon: Users },
  { id: "inventory" as PageId, label: "Inventory Management", icon: Warehouse },
];

// ─── Google Sheets Fetch ──────────────────────────────────────────────────────

async function fetchSheet(sheetId: string, sheetName: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return result.data;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  // Try DD/MM/YYYY
  const m = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(year, parseInt(mo) - 1, parseInt(d));
  }
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function parseSalesRows(rows: string[][]): SalesRow[] {
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    date: parseDate(r[0] || ""),
    invoice: r[1]?.trim() || "",
    customer: r[2]?.trim() || "",
    productCode: r[3]?.trim() || "",
    productName: r[4]?.trim() || "",
    quantity: parseFloat((r[5] || "0").replace(/,/g, "")) || 0,
    unitPrice: parseFloat((r[6] || "0").replace(/,/g, "")) || 0,
    revenue: parseFloat((r[7] || "0").replace(/,/g, "")) || 0,
    product: r[8]?.trim() || "",
    productId: r[9]?.trim() || "",
    mainProduct: r[10]?.trim() || "",
  })).filter((r) => r.invoice || r.customer);
}

function parseInventoryRows(rows: string[][]): InventoryRow[] {
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    productName: r[0]?.trim() || "",
    sku: r[1]?.trim() || "",
    openingStock: parseFloat((r[2] || "0").replace(/,/g, "")) || 0,
    received: parseFloat((r[3] || "0").replace(/,/g, "")) || 0,
    shipped: parseFloat((r[4] || "0").replace(/,/g, "")) || 0,
    endPeriodShipped: parseFloat((r[5] || "0").replace(/,/g, "")) || 0,
    endPeriodActual: parseFloat((r[6] || "0").replace(/,/g, "")) || 0,
    available: parseFloat((r[7] || "0").replace(/,/g, "")) || 0,
  })).filter((r) => r.productName || r.sku);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useGoogleSheets(config: SheetConfig | null) {
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!config?.sheetId) return;
    setLoading(true);
    setError(null);
    try {
      const [salesRaw, invRaw] = await Promise.all([
        fetchSheet(config.sheetId, "Doanh thu USA"),
        fetchSheet(config.sheetId, "BangTonKho"),
      ]);
      setSales(parseSalesRows(salesRaw));
      setInventory(parseInventoryRows(invRaw));
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [config?.sheetId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { sales, inventory, loading, error, refresh, lastRefresh };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-US");
const fmtUSD = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
    ? `$${(v / 1_000).toFixed(1)}K`
    : `$${fmt.format(Math.round(v))}`;

const fmtFull = (v: number) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(k: string) {
  const [y, m] = k.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function sum(arr: number[]) { return arr.reduce((a, b) => a + b, 0); }

// Export helpers
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(data[0] || {});
  const rows = [headers.join(","), ...data.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────

function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "yellow" | "red" | "gray" }) {
  const cls = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-slate-100 text-slate-600",
  }[color];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  sub?: string;
  trend?: number;
  icon: React.ElementType;
  color?: string;
  delay?: number;
}

function KPICard({ title, value, sub, trend, icon: Icon, color = "#2563EB", delay = 0 }: KPICardProps) {
  const [displayed, setDisplayed] = useState("—");
  const isUp = trend !== undefined && trend >= 0;

  useEffect(() => {
    const t = setTimeout(() => setDisplayed(value), delay * 100);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.35, ease: "easeOut" }}
    >
      <Card className="p-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide leading-tight">{title}</p>
          <div className="p-1.5 rounded-md" style={{ backgroundColor: color + "18" }}>
            <Icon size={15} style={{ color }} />
          </div>
        </div>
        <div className="text-2xl font-semibold text-slate-900 font-mono tabular-nums">{displayed}</div>
        <div className="flex items-center gap-2 mt-1.5">
          {trend !== undefined && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-red-500"}`}>
              {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub && <span className="text-xs text-slate-400">{sub}</span>}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Filter Components ────────────────────────────────────────────────────────

interface SelectFilterProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

function SelectFilter({ label, value, options, onChange }: SelectFilterProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8 appearance-none cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  return (
    <div className="flex gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">From</label>
        <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">To</label>
        <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency = false }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      {label && <p className="font-medium text-slate-900 mb-2">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold text-slate-900 font-mono">{currency ? fmtFull(p.value) : fmt.format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Table Component ──────────────────────────────────────────────────────────

interface TableProps {
  columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
  rows: Record<string, React.ReactNode>[];
  maxRows?: number;
}

function DataTable({ columns, rows, maxRows = 10 }: TableProps) {
  const [page, setPage] = useState(0);
  const pageRows = rows.slice(page * maxRows, (page + 1) * maxRows);
  const pages = Math.ceil(rows.length / maxRows);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {columns.map((c) => (
                <th key={c.key} className={`py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className={`py-2.5 px-3 text-slate-700 ${c.align === "right" ? "text-right font-mono" : c.align === "center" ? "text-center" : ""}`}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between pt-3 px-1">
          <span className="text-xs text-slate-400">{rows.length} records</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">Prev</button>
            <span className="px-2 py-1 text-xs text-slate-600">{page + 1}/{pages}</span>
            <button onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page === pages - 1} className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function DroneIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="4" fill="#2563EB" />
      <circle cx="16" cy="16" r="2" fill="#BFDBFE" />
      <line x1="16" y1="12" x2="16" y2="2" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="20" x2="16" y2="30" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="16" x2="2" y2="16" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="16" x2="30" y2="16" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="16" cy="2" rx="4" ry="1.5" fill="#3B82F6" opacity="0.7" />
      <ellipse cx="16" cy="30" rx="4" ry="1.5" fill="#3B82F6" opacity="0.7" />
      <ellipse cx="2" cy="16" rx="1.5" ry="4" fill="#3B82F6" opacity="0.7" />
      <ellipse cx="30" cy="16" rx="1.5" ry="4" fill="#3B82F6" opacity="0.7" />
    </svg>
  );
}

interface SidebarProps {
  activePage: PageId;
  onNavigate: (id: PageId) => void;
}

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="flex flex-col h-full" style={{ backgroundColor: NAVY, width: 220 }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <DroneIcon size={30} />
        <div>
          <div className="text-white font-semibold text-sm leading-tight">Gremsy</div>
          <div className="text-blue-400 text-xs">Sales Analytics</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <div className="text-xs font-medium uppercase tracking-wider px-3 mb-3" style={{ color: "rgba(148,163,184,0.6)" }}>Main Menu</div>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left"
              style={{
                backgroundColor: active ? "#2563EB" : "transparent",
                color: active ? "#FFFFFF" : "#94A3B8",
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#E2E8F0"; }}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; } }}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">G</div>
          <div>
            <div className="text-xs text-white font-medium">Sales Admin</div>
            <div className="text-xs" style={{ color: "#64748B" }}>Gremsy Co.</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────

interface HeaderProps {
  title: string;
  subtitle: string;
  loading: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
}

function Header({ title, subtitle, loading, lastRefresh, onRefresh, onExportCSV, onPrint }: HeaderProps) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        {lastRefresh && (
          <p className="text-xs text-slate-400 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
        <button onClick={onExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <Download size={14} />
          CSV
        </button>
        <button onClick={onPrint} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <Printer size={14} />
          Print
        </button>
      </div>
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onConnect }: { onConnect: (id: string) => void }) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = () => {
    const v = input.trim();
    if (!v) { setErr("Please enter a Sheet ID or URL."); return; }
    const match = v.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const id = match ? match[1] : v;
    if (id.length < 20) { setErr("That doesn't look like a valid Sheet ID."); return; }
    onConnect(id);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl border border-slate-200 shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex justify-center mb-6">
          <div className="p-3 rounded-xl bg-blue-50">
            <FileSpreadsheet size={28} className="text-blue-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 text-center mb-1">Connect Google Sheets</h2>
        <p className="text-sm text-slate-500 text-center mb-6">Paste your Google Sheets URL or Sheet ID below. Make sure the sheet is shared publicly (Anyone with link → Viewer).</p>

        <div className="space-y-3">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button onClick={handleSubmit} className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Connect & Load Data
          </button>
        </div>

        <div className="mt-5 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs text-amber-700 font-medium mb-1">Required sheet names:</p>
          <ul className="text-xs text-amber-600 space-y-0.5">
            <li>• <span className="font-mono">Doanh thu USA</span> — Sales data</li>
            <li>• <span className="font-mono">BangTonKho</span> — Inventory data</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Chart helpers ─────────────────────────────────────────────────────────────

function BarChart2({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-48 text-slate-300">
      <div className="text-center">
        <Database size={28} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs text-slate-400">No data available</p>
      </div>
    </div>
  );
}

// ─── Sales Overview Page ───────────────────────────────────────────────────────

function SalesOverview({ sales, onExport, onRefresh, loading, lastRefresh }: {
  sales: SalesRow[];
  onExport: () => void;
  onRefresh: () => void;
  loading: boolean;
  lastRefresh: Date | null;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterMainProduct, setFilterMainProduct] = useState("");

  const customers = useMemo(() => [...new Set(sales.map((r) => r.customer).filter(Boolean))].sort(), [sales]);
  const products = useMemo(() => [...new Set(sales.map((r) => r.product).filter(Boolean))].sort(), [sales]);
  const mainProducts = useMemo(() => [...new Set(sales.map((r) => r.mainProduct).filter(Boolean))].sort(), [sales]);

  const filtered = useMemo(() => {
    return sales.filter((r) => {
      if (filterCustomer && r.customer !== filterCustomer) return false;
      if (filterProduct && r.product !== filterProduct) return false;
      if (filterMainProduct && r.mainProduct !== filterMainProduct) return false;
      if (dateFrom && r.date && r.date < new Date(dateFrom)) return false;
      if (dateTo && r.date && r.date > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [sales, filterCustomer, filterProduct, filterMainProduct, dateFrom, dateTo]);

  const totalRevenue = useMemo(() => sum(filtered.map((r) => r.revenue)), [filtered]);
  const totalInvoices = useMemo(() => new Set(filtered.map((r) => r.invoice)).size, [filtered]);
  const totalQty = useMemo(() => sum(filtered.map((r) => r.quantity)), [filtered]);
  const avgOrder = totalInvoices ? totalRevenue / totalInvoices : 0;
  const totalCustomers = useMemo(() => new Set(filtered.map((r) => r.customer)).size, [filtered]);

  const byProduct = useMemo(() => {
    const g = groupBy(filtered, (r) => r.mainProduct || r.product || "Unknown");
    return Object.entries(g).map(([name, rows]) => ({ name, revenue: sum(rows.map((r) => r.revenue)) })).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const topProduct = byProduct[0];
  const totalRev = sum(byProduct.map((p) => p.revenue));

  const byMonth = useMemo(() => {
    const g: Record<string, number> = {};
    filtered.forEach((r) => {
      if (!r.date) return;
      const k = monthKey(r.date);
      g[k] = (g[k] || 0) + r.revenue;
    });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ month: monthLabel(k), revenue: v }));
  }, [filtered]);

  const byCustomer = useMemo(() => {
    const g = groupBy(filtered, (r) => r.customer || "Unknown");
    return Object.entries(g).map(([name, rows]) => ({ name, revenue: sum(rows.map((r) => r.revenue)) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filtered]);

  const topTransactions = useMemo(() =>
    [...filtered].sort((a, b) => b.revenue - a.revenue).slice(0, 50).map((r) => ({
      invoice: r.invoice,
      customer: r.customer,
      product: r.product || r.productName,
      quantity: fmt.format(r.quantity),
      revenue: fmtFull(r.revenue),
    })),
    [filtered]
  );

  const exportData = () => {
    downloadCSV(topTransactions, "sales_overview.csv");
    onExport();
  };

  return (
    <div>
      <Header
        title="Sales Overview"
        subtitle="Executive performance summary across the UAV portfolio"
        loading={loading}
        lastRefresh={lastRefresh}
        onRefresh={onRefresh}
        onExportCSV={exportData}
        onPrint={() => window.print()}
      />

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          <SelectFilter label="Customer" value={filterCustomer} options={customers} onChange={setFilterCustomer} />
          <SelectFilter label="Product" value={filterProduct} options={products} onChange={setFilterProduct} />
          <SelectFilter label="Main Product" value={filterMainProduct} options={mainProducts} onChange={setFilterMainProduct} />
          {(filterCustomer || filterProduct || filterMainProduct || dateFrom || dateTo) && (
            <button onClick={() => { setFilterCustomer(""); setFilterProduct(""); setFilterMainProduct(""); setDateFrom(""); setDateTo(""); }} className="self-end text-xs text-blue-600 hover:underline">Clear all</button>
          )}
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPICard title="Total Revenue" value={fmtUSD(totalRevenue)} icon={TrendingUp} color="#2563EB" delay={0} />
        <KPICard title="Total Invoices" value={fmt.format(totalInvoices)} icon={FileSpreadsheet} color="#10B981" delay={1} />
        <KPICard title="Total Qty Sold" value={fmt.format(totalQty)} icon={Package} color="#F59E0B" delay={2} />
        <KPICard title="Avg Order Value" value={fmtUSD(avgOrder)} icon={BarChart2} color="#8B5CF6" delay={3} />
        <KPICard title="Total Customers" value={fmt.format(totalCustomers)} icon={Users} color="#06B6D4" delay={4} />
        <KPICard title="Top Product Revenue" value={topProduct ? fmtUSD(topProduct.revenue) : "—"} sub={topProduct?.name} icon={TrendingUp} color="#2563EB" delay={5} />
        <KPICard title="Revenue Contribution" value={topProduct && totalRev ? `${((topProduct.revenue / totalRev) * 100).toFixed(1)}%` : "—"} sub="Top product" icon={Radio} color="#10B981" delay={6} />
        <KPICard title="Total Products" value={fmt.format(byProduct.length)} icon={Package} color="#EF4444" delay={7} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-700 mb-4">Revenue Trend by Month</p>
          {byMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} width={60} />
                <Tooltip content={<ChartTooltip currency />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: "#2563EB", r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Revenue by Product</p>
          {byProduct.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byProduct.slice(0, 7)} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="revenue" nameKey="name">
                  {byProduct.slice(0, 7).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtFull(v)} />
                <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ fontSize: 11, color: "#64748B" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Top 10 Customers by Revenue</p>
          {byCustomer.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byCustomer} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} width={110} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip currency />} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                  {byCustomer.map((_, i) => <Cell key={i} fill={`${CHART_COLORS[0]}${i === 0 ? "FF" : "99"}`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Monthly Revenue Comparison</p>
          {byMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} width={60} />
                <Tooltip content={<ChartTooltip currency />} />
                <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* Table */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-700 mb-4">Top Revenue Transactions</p>
        <DataTable
          columns={[
            { key: "invoice", label: "Invoice" },
            { key: "customer", label: "Customer" },
            { key: "product", label: "Product" },
            { key: "quantity", label: "Qty", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
          ]}
          rows={topTransactions}
        />
      </Card>
    </div>
  );
}

// ─── Product Analysis Page ─────────────────────────────────────────────────────

function ProductAnalysis({ sales, onRefresh, loading, lastRefresh }: {
  sales: SalesRow[];
  onRefresh: () => void;
  loading: boolean;
  lastRefresh: Date | null;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterMainProduct, setFilterMainProduct] = useState("");

  const products = useMemo(() => [...new Set(sales.map((r) => r.product).filter(Boolean))].sort(), [sales]);
  const mainProducts = useMemo(() => [...new Set(sales.map((r) => r.mainProduct).filter(Boolean))].sort(), [sales]);

  const filtered = useMemo(() => sales.filter((r) => {
    if (filterProduct && r.product !== filterProduct) return false;
    if (filterMainProduct && r.mainProduct !== filterMainProduct) return false;
    if (dateFrom && r.date && r.date < new Date(dateFrom)) return false;
    if (dateTo && r.date && r.date > new Date(dateTo + "T23:59:59")) return false;
    return true;
  }), [sales, filterProduct, filterMainProduct, dateFrom, dateTo]);

  const byProduct = useMemo(() => {
    const g = groupBy(filtered, (r) => r.mainProduct || r.product || "Unknown");
    return Object.entries(g).map(([name, rows]) => {
      const revenue = sum(rows.map((r) => r.revenue));
      const qty = sum(rows.map((r) => r.quantity));
      return { name, revenue, qty, avgPrice: qty ? revenue / qty : 0 };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const totalRev = sum(byProduct.map((p) => p.revenue));
  const totalProducts = byProduct.length;

  // ABC Analysis
  const abcData = useMemo(() => {
    let cumRev = 0;
    return byProduct.map((p) => {
      cumRev += p.revenue;
      const pct = totalRev ? (cumRev / totalRev) * 100 : 0;
      const cat = pct <= 70 ? "A" : pct <= 90 ? "B" : "C";
      return { ...p, pct: totalRev ? (p.revenue / totalRev) * 100 : 0, cat };
    });
  }, [byProduct, totalRev]);

  const abcSummary = useMemo(() => {
    const A = abcData.filter((p) => p.cat === "A").length;
    const B = abcData.filter((p) => p.cat === "B").length;
    const C = abcData.filter((p) => p.cat === "C").length;
    return [
      { name: "Category A (Top 70%)", value: A, fill: "#2563EB" },
      { name: "Category B (Next 20%)", value: B, fill: "#10B981" },
      { name: "Category C (Last 10%)", value: C, fill: "#F59E0B" },
    ];
  }, [abcData]);

  const tableRows = abcData.map((p) => ({
    product: p.name,
    revenue: fmtFull(p.revenue),
    quantity: fmt.format(p.qty),
    avgPrice: fmtFull(p.avgPrice),
    contribution: `${p.pct.toFixed(1)}%`,
    category: <Badge color={p.cat === "A" ? "blue" : p.cat === "B" ? "green" : "yellow"}>{p.cat}</Badge>,
  }));

  const exportData = () => downloadCSV(abcData.map((p) => ({ product: p.name, revenue: p.revenue, quantity: p.qty, avgPrice: p.avgPrice, pct: p.pct.toFixed(1) + "%", category: p.cat })), "product_analysis.csv");

  const bestSelling = [...byProduct].sort((a, b) => b.qty - a.qty)[0];
  const highestRevenue = byProduct[0];
  const avgPrice = byProduct.length ? sum(byProduct.map((p) => p.avgPrice)) / byProduct.length : 0;
  const totalQtySold = sum(byProduct.map((p) => p.qty));

  // Top 5 product names for combo chart (stable reference)
  const top5Products = useMemo(() => byProduct.slice(0, 5).map((p) => p.name), [byProduct]);

  // Monthly combo data: revenue stacked by top-5 product + total quantity line
  const comboData = useMemo(() => {
    const months: Record<string, Record<string, number>> = {};
    filtered.forEach((r) => {
      if (!r.date) return;
      const k = monthKey(r.date);
      const prod = r.mainProduct || r.product || "Unknown";
      if (!months[k]) months[k] = { _qty: 0 };
      if (top5Products.includes(prod)) {
        months[k][prod] = (months[k][prod] || 0) + r.revenue;
      }
      months[k]["_qty"] = (months[k]["_qty"] || 0) + r.quantity;
    });
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ month: monthLabel(k), ...v }));
  }, [filtered, top5Products]);

  return (
    <div>
      <Header title="Product Analysis" subtitle="Product performance, ranking, and revenue contribution" loading={loading} lastRefresh={lastRefresh} onRefresh={onRefresh} onExportCSV={exportData} onPrint={() => window.print()} />

      <Card className="p-4 mb-5">
        <div className="flex items-center gap-2 mb-3"><Filter size={14} className="text-slate-400" /><span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</span></div>
        <div className="flex flex-wrap gap-4">
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          <SelectFilter label="Product" value={filterProduct} options={products} onChange={setFilterProduct} />
          <SelectFilter label="Main Product" value={filterMainProduct} options={mainProducts} onChange={setFilterMainProduct} />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPICard title="Total Products" value={fmt.format(totalProducts)} icon={Package} color="#2563EB" delay={0} />
        <KPICard title="Best Selling Product" value={bestSelling?.name || "—"} sub={`${fmt.format(bestSelling?.qty || 0)} units`} icon={TrendingUp} color="#10B981" delay={1} />
        <KPICard title="Highest Revenue Product" value={highestRevenue?.name || "—"} sub={fmtUSD(highestRevenue?.revenue || 0)} icon={TrendingUp} color="#8B5CF6" delay={2} />
        <KPICard title="Avg Selling Price" value={fmtUSD(avgPrice)} icon={Radio} color="#F59E0B" delay={3} />
        <KPICard title="Total Products Sold" value={fmt.format(totalQtySold)} sub="units" icon={Package} color="#06B6D4" delay={4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Product Revenue Ranking</p>
          {byProduct.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, byProduct.slice(0, 10).length * 36)}>
              <BarChart data={byProduct.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} width={120} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip currency />} />
                <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Product Quantity Ranking</p>
          {byProduct.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, byProduct.slice(0, 10).length * 36)}>
              <BarChart data={byProduct.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} width={120} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="qty" name="Quantity" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* Combo Chart: Product Sales Performance Over Time */}
      <Card className="p-4 mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-1">Product Sales Performance Over Time</p>
        <p className="text-xs text-slate-400 mb-4">Revenue by product (bars, left axis) · Total quantity sold (line, right axis)</p>
        {comboData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={comboData} margin={{ top: 4, right: 48, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} width={64} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#F59E0B" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm max-w-xs">
                      <p className="font-medium text-slate-900 mb-2">{label}</p>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 mb-0.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-slate-600 truncate">{p.name}:</span>
                          <span className="font-semibold font-mono text-slate-900 flex-shrink-0">
                            {p.name === "Qty Sold" ? fmt.format(p.value as number) : fmtFull(p.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ fontSize: 10, color: "#64748B" }}>{v}</span>} />
              {top5Products.map((name, i) => (
                <Bar key={name} yAxisId="left" dataKey={name} name={name} stackId="rev" fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} radius={i === top5Products.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
              <Line yAxisId="right" type="monotone" dataKey="_qty" name="Qty Sold" stroke="#F59E0B" strokeWidth={2.5} dot={{ fill: "#F59E0B", r: 3 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">ABC Analysis</p>
          {abcSummary.some((s) => s.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={abcSummary} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name">
                    {abcSummary.map((s, i) => <Cell key={i} fill={s.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ fontSize: 11, color: "#64748B" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {abcSummary.map((s) => (
                  <div key={s.name} className="text-center p-2 rounded-lg" style={{ backgroundColor: s.fill + "12" }}>
                    <div className="text-xl font-bold" style={{ color: s.fill }}>{s.value}</div>
                    <div className="text-xs text-slate-500">{s.name.split(" ")[1]}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-700 mb-4">Product Performance</p>
        <DataTable
          columns={[
            { key: "product", label: "Product" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "quantity", label: "Quantity", align: "right" },
            { key: "avgPrice", label: "Avg Price", align: "right" },
            { key: "contribution", label: "Contribution", align: "right" },
            { key: "category", label: "Category", align: "center" },
          ]}
          rows={tableRows}
        />
      </Card>
    </div>
  );
}

// ─── Customer Analysis Page ───────────────────────────────────────────────────

function CustomerAnalysis({ sales, onRefresh, loading, lastRefresh }: {
  sales: SalesRow[];
  onRefresh: () => void;
  loading: boolean;
  lastRefresh: Date | null;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");

  const customers = useMemo(() => [...new Set(sales.map((r) => r.customer).filter(Boolean))].sort(), [sales]);

  const filtered = useMemo(() => sales.filter((r) => {
    if (filterCustomer && r.customer !== filterCustomer) return false;
    if (dateFrom && r.date && r.date < new Date(dateFrom)) return false;
    if (dateTo && r.date && r.date > new Date(dateTo + "T23:59:59")) return false;
    return true;
  }), [sales, filterCustomer, dateFrom, dateTo]);

  const byCustomer = useMemo(() => {
    const g = groupBy(filtered, (r) => r.customer || "Unknown");
    return Object.entries(g).map(([name, rows]) => {
      const revenue = sum(rows.map((r) => r.revenue));
      const qty = sum(rows.map((r) => r.quantity));
      const invoices = new Set(rows.map((r) => r.invoice)).size;
      return { name, revenue, qty, invoices };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const totalRev = sum(byCustomer.map((c) => c.revenue));
  const totalCustomers = byCustomer.length;
  const avgRevPerCustomer = totalCustomers ? totalRev / totalCustomers : 0;
  const largestCustomer = byCustomer[0];

  // Top 5 customers by total revenue — stable memo so Line keys don't flicker
  const top5Names = useMemo(() => byCustomer.slice(0, 5).map((c) => c.name), [byCustomer]);

  // Monthly trend with zero-fill: every month has a value for every top-5 customer
  const monthlyTrend = useMemo(() => {
    const months: Record<string, Record<string, number>> = {};
    filtered.forEach((r) => {
      if (!r.date || !top5Names.includes(r.customer)) return;
      const k = monthKey(r.date);
      if (!months[k]) months[k] = {};
      months[k][r.customer] = (months[k][r.customer] || 0) + r.revenue;
    });
    const allMonths = Object.keys(months).sort();
    return allMonths.map((k) => {
      const base: Record<string, string | number> = { month: monthLabel(k) };
      top5Names.forEach((name) => { base[name] = months[k][name] ?? 0; });
      return base;
    });
  }, [filtered, top5Names]);

  const tableRows = byCustomer.map((c) => ({
    customer: c.name,
    invoices: fmt.format(c.invoices),
    revenue: fmtFull(c.revenue),
    quantity: fmt.format(c.qty),
    share: `${totalRev ? ((c.revenue / totalRev) * 100).toFixed(1) : 0}%`,
  }));

  const exportData = () => downloadCSV(tableRows.map((r) => ({ ...r })), "customer_analysis.csv");

  return (
    <div>
      <Header title="Customer Analysis" subtitle="Revenue distribution and customer concentration insights" loading={loading} lastRefresh={lastRefresh} onRefresh={onRefresh} onExportCSV={exportData} onPrint={() => window.print()} />

      <Card className="p-4 mb-5">
        <div className="flex items-center gap-2 mb-3"><Filter size={14} className="text-slate-400" /><span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</span></div>
        <div className="flex flex-wrap gap-4">
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          <SelectFilter label="Customer" value={filterCustomer} options={customers} onChange={setFilterCustomer} />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KPICard title="Total Customers" value={fmt.format(totalCustomers)} icon={Users} color="#2563EB" delay={0} />
        <KPICard title="Active Customers" value={fmt.format(byCustomer.filter((c) => c.invoices > 1).length)} sub="2+ invoices" icon={CheckCircle} color="#10B981" delay={1} />
        <KPICard title="Avg Rev / Customer" value={fmtUSD(avgRevPerCustomer)} icon={TrendingUp} color="#8B5CF6" delay={2} />
        <KPICard title="Top Customer Revenue" value={largestCustomer ? fmtUSD(largestCustomer.revenue) : "—"} sub={largestCustomer?.name} icon={TrendingUp} color="#F59E0B" delay={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Customer Revenue Ranking</p>
          {byCustomer.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, Math.min(byCustomer.length, 12) * 30)}>
              <BarChart data={byCustomer.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} width={130} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip currency />} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                  {byCustomer.slice(0, 12).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Revenue Distribution by Customer</p>
          {byCustomer.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCustomer.slice(0, 8)} cx="50%" cy="50%" outerRadius={100} dataKey="revenue" nameKey="name" paddingAngle={1}>
                  {byCustomer.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtFull(v)} />
                <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ fontSize: 10, color: "#64748B" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>

      <Card className="p-4 mb-5">
        <p className="text-sm font-semibold text-slate-700 mb-1">Revenue Trend — Top {top5Names.length} Customers</p>
        <p className="text-xs text-slate-400 mb-4">Monthly revenue by highest-value customers within the selected period</p>
        {monthlyTrend.length > 0 && top5Names.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyTrend} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUSD(v)} width={64} />
              <Tooltip content={<ChartTooltip currency />} />
              <Legend iconSize={8} iconType="circle" formatter={(v) => <span style={{ fontSize: 10, color: "#64748B" }}>{v}</span>} />
              {top5Names.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-700 mb-4">Customer Performance</p>
        <DataTable
          columns={[
            { key: "customer", label: "Customer" },
            { key: "invoices", label: "Invoices", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "quantity", label: "Qty Purchased", align: "right" },
            { key: "share", label: "Share %", align: "right" },
          ]}
          rows={tableRows}
        />
      </Card>
    </div>
  );
}

// ─── Inventory Page ───────────────────────────────────────────────────────────

function InventoryManagement({ inventory, onRefresh, loading, lastRefresh }: {
  inventory: InventoryRow[];
  onRefresh: () => void;
  loading: boolean;
  lastRefresh: Date | null;
}) {
  const [filterProduct, setFilterProduct] = useState("");
  const [filterSku, setFilterSku] = useState("");

  const products = useMemo(() => [...new Set(inventory.map((r) => r.productName).filter(Boolean))].sort(), [inventory]);
  const skus = useMemo(() => [...new Set(inventory.map((r) => r.sku).filter(Boolean))].sort(), [inventory]);

  const filtered = useMemo(() => inventory.filter((r) => {
    if (filterProduct && r.productName !== filterProduct) return false;
    if (filterSku && r.sku !== filterSku) return false;
    return true;
  }), [inventory, filterProduct, filterSku]);

  const getStatus = (available: number): "Healthy" | "Low Stock" | "Out of Stock" => {
    if (available <= 0) return "Out of Stock";
    if (available < 10) return "Low Stock";
    return "Healthy";
  };

  const withStatus = useMemo(() => filtered.map((r) => ({ ...r, status: getStatus(r.available) })), [filtered]);

  const totalSKUs = new Set(filtered.map((r) => r.sku)).size;
  const totalAvailable = sum(filtered.map((r) => r.available));
  const totalShipped = sum(filtered.map((r) => r.shipped));
  const lowStock = withStatus.filter((r) => r.status === "Low Stock").length;
  const outOfStock = withStatus.filter((r) => r.status === "Out of Stock").length;

  const healthData = [
    { name: "Healthy", value: withStatus.filter((r) => r.status === "Healthy").length, fill: "#10B981" },
    { name: "Low Stock", value: lowStock, fill: "#F59E0B" },
    { name: "Out of Stock", value: outOfStock, fill: "#EF4444" },
  ].filter((d) => d.value > 0);

  const topInventory = [...withStatus].sort((a, b) => b.available - a.available).slice(0, 10);
  const lowStockItems = withStatus.filter((r) => r.status === "Low Stock" || r.status === "Out of Stock").sort((a, b) => a.available - b.available);

  const tableRows = withStatus.map((r) => ({
    product: r.productName,
    sku: <span className="font-mono text-xs text-slate-600">{r.sku}</span>,
    opening: fmt.format(r.openingStock),
    received: fmt.format(r.received),
    shipped: fmt.format(r.shipped),
    available: <span className={`font-mono font-semibold ${r.status === "Out of Stock" ? "text-red-600" : r.status === "Low Stock" ? "text-amber-600" : "text-slate-900"}`}>{fmt.format(r.available)}</span>,
    status: (
      <Badge color={r.status === "Healthy" ? "green" : r.status === "Low Stock" ? "yellow" : "red"}>
        {r.status}
      </Badge>
    ),
  }));

  const exportData = () => downloadCSV(withStatus.map((r) => ({ product: r.productName, sku: r.sku, opening: r.openingStock, received: r.received, shipped: r.shipped, available: r.available, status: r.status })), "inventory.csv");

  return (
    <div>
      <Header title="Inventory Management" subtitle="Stock levels, health status, and replenishment alerts" loading={loading} lastRefresh={lastRefresh} onRefresh={onRefresh} onExportCSV={exportData} onPrint={() => window.print()} />

      <Card className="p-4 mb-5">
        <div className="flex items-center gap-2 mb-3"><Filter size={14} className="text-slate-400" /><span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</span></div>
        <div className="flex flex-wrap gap-4">
          <SelectFilter label="Product" value={filterProduct} options={products} onChange={setFilterProduct} />
          <SelectFilter label="SKU" value={filterSku} options={skus} onChange={setFilterSku} />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <KPICard title="Total SKUs" value={fmt.format(totalSKUs)} icon={Package} color="#2563EB" delay={0} />
        <KPICard title="Total Available" value={fmt.format(totalAvailable)} icon={Warehouse} color="#10B981" delay={1} />
        <KPICard title="Total Shipped" value={fmt.format(totalShipped)} icon={TrendingUp} color="#8B5CF6" delay={2} />
        <KPICard title="Low Stock" value={fmt.format(lowStock)} sub="< 10 units" icon={AlertTriangle} color="#F59E0B" delay={3} />
        <KPICard title="Out of Stock" value={fmt.format(outOfStock)} sub="0 units" icon={X} color="#EF4444" delay={4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-700 mb-4">Inventory by Product (Top 10)</p>
          {topInventory.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, topInventory.length * 32)}>
              <BarChart data={topInventory} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="productName" tick={{ fontSize: 10, fill: "#64748B" }} width={140} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="available" name="Available" radius={[0, 4, 4, 0]}>
                  {topInventory.map((r, i) => (
                    <Cell key={i} fill={r.status === "Out of Stock" ? "#EF4444" : r.status === "Low Stock" ? "#F59E0B" : "#10B981"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-4">Inventory Health</p>
          {healthData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={healthData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name">
                    {healthData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {[
                  { label: "Healthy", count: withStatus.filter((r) => r.status === "Healthy").length, color: "#10B981", bg: "#F0FDF4" },
                  { label: "Low Stock", count: lowStock, color: "#F59E0B", bg: "#FFFBEB" },
                  { label: "Out of Stock", count: outOfStock, color: "#EF4444", bg: "#FEF2F2" },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: bg }}>
                    <span className="text-xs font-medium" style={{ color }}>{label}</span>
                    <span className="text-sm font-bold" style={{ color }}>{count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* Alert Section */}
      {lowStockItems.length > 0 && (
        <Card className="p-4 mb-4 border-amber-200" style={{ backgroundColor: "#FFFBEB" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Low Stock Alert — {lowStockItems.length} product{lowStockItems.length > 1 ? "s" : ""} requiring replenishment</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {lowStockItems.slice(0, 6).map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                <div>
                  <p className="text-xs font-medium text-slate-800">{r.productName}</p>
                  <p className="text-xs text-slate-500 font-mono">{r.sku}</p>
                </div>
                <Badge color={r.status === "Out of Stock" ? "red" : "yellow"}>
                  {r.status === "Out of Stock" ? "0 units" : `${r.available} units`}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-700 mb-4">Inventory Detail</p>
        <DataTable
          columns={[
            { key: "product", label: "Product Name" },
            { key: "sku", label: "SKU" },
            { key: "opening", label: "Opening Stock", align: "right" },
            { key: "received", label: "Received", align: "right" },
            { key: "shipped", label: "Shipped", align: "right" },
            { key: "available", label: "Available", align: "right" },
            { key: "status", label: "Status", align: "center" },
          ]}
          rows={tableRows}
        />
      </Card>
    </div>
  );
}

// ─── Loading / Error overlays ─────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 size={28} className="animate-spin text-blue-600" />
      <p className="text-sm text-slate-500">Loading data from Google Sheets…</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
      <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">Failed to load data</p>
        <p className="text-xs text-red-600 mt-0.5">{message}</p>
        <p className="text-xs text-red-500 mt-1">Make sure your sheet is shared publicly (Anyone with link → Viewer).</p>
      </div>
      <button onClick={onRetry} className="text-xs text-red-600 underline flex-shrink-0">Retry</button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gremsy_sheet_id";

export default function App() {
  const [config, setConfig] = useState<SheetConfig | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { sheetId: saved } : null;
  });
  const [activePage, setActivePage] = useState<PageId>("overview");

  const { sales, inventory, loading, error, refresh, lastRefresh } = useGoogleSheets(config);

  const handleConnect = (sheetId: string) => {
    localStorage.setItem(STORAGE_KEY, sheetId);
    setConfig({ sheetId });
  };

  const handleDisconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(null);
  };

  if (!config) return <SetupScreen onConnect={handleConnect} />;

  const pageProps = { loading, lastRefresh, onRefresh: refresh };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="flex-shrink-0 h-full">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-800">Sales Operations Dashboard</span>
              <span className="ml-2 text-xs text-slate-400">• Gremsy USA</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" /> Syncing…</span>}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Database size={12} />
              <span className="font-mono text-slate-400">{config.sheetId.slice(0, 12)}…</span>
            </div>
            <button onClick={handleDisconnect} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Disconnect</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && <ErrorBanner message={error} onRetry={refresh} />}
          {loading && sales.length === 0 && inventory.length === 0 ? (
            <LoadingOverlay />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activePage} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>
                {activePage === "overview" && <SalesOverview sales={sales} onExport={() => {}} {...pageProps} />}
                {activePage === "product" && <ProductAnalysis sales={sales} {...pageProps} />}
                {activePage === "customer" && <CustomerAnalysis sales={sales} {...pageProps} />}
                {activePage === "inventory" && <InventoryManagement inventory={inventory} {...pageProps} />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
