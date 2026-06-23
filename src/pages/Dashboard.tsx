import { useHoldings } from "@/hooks/useHoldings"
import { useProfile } from "@/hooks/useProfile"
import { usePortfolioSnapshots } from "@/hooks/usePortfolioSnapshots"
import { useUIStore } from "@/stores/uiStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatPercentage } from "@/lib/utils"
import type { AllocationData } from "@/types/database"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts"
import { AlertTriangle, TrendingUp, TrendingDown, Wallet } from "lucide-react"

const COLORS: Record<string, string> = {
  CRYPTO: "#f7931a",
  EQUITY_IN: "#4caf50",
  EQUITY_US: "#2196f3",
}

const LABELS: Record<string, string> = {
  CRYPTO: "Crypto",
  EQUITY_IN: "Indian Equity",
  EQUITY_US: "US Equity",
}

export default function DashboardPage() {
  const { data: holdings, isLoading } = useHoldings()
  const { data: profile } = useProfile()
  const { data: _snapshots } = usePortfolioSnapshots(30)
  const _displayCurrency = useUIStore((s) => s.displayCurrency)
  void _snapshots; void _displayCurrency;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  const holdingsArr = holdings ?? []
  const totalValueUsd = holdingsArr.reduce((sum, h) => sum + (h.current_value_usd ?? 0), 0)

  // Compute allocation data
  const allocationMap = new Map<string, { value: number; target: number }>()
  allocationMap.set("CRYPTO", { value: 0, target: profile?.target_crypto ?? 10 })
  allocationMap.set("EQUITY_IN", { value: 0, target: profile?.target_equity_in ?? 50 })
  allocationMap.set("EQUITY_US", { value: 0, target: profile?.target_equity_us ?? 40 })

  holdingsArr.forEach((h) => {
    const entry = allocationMap.get(h.asset_class)
    if (entry) entry.value += h.current_value_usd ?? 0
  })

  const allocationData: AllocationData[] = Array.from(allocationMap.entries()).map(
    ([key, val]) => ({
      asset_class: key as AllocationData["asset_class"],
      label: LABELS[key] ?? key,
      current_pct: totalValueUsd > 0 ? (val.value / totalValueUsd) * 100 : 0,
      target_pct: val.target,
      value_usd: val.value,
      value_inr: val.value * 83,
    })
  )

  // Detect drift
  const driftThreshold = profile?.drift_threshold ?? 5
  const drifts = allocationData.filter(
    (a) => Math.abs(a.current_pct - a.target_pct) > driftThreshold
  )

  // Day change
  const dayChangePct = holdingsArr.reduce((sum, h) => {
    const weight = totalValueUsd > 0 ? (h.current_value_usd ?? 0) / totalValueUsd : 0
    return sum + (h.day_change_pct ?? 0) * weight
  }, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Portfolio overview & allocation</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalValueUsd, "USD")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ {formatCurrency(totalValueUsd * 83, "INR")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Day Change</CardTitle>
            {dayChangePct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dayChangePct >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatPercentage(dayChangePct)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{holdingsArr.length}</div>
            <p className="text-xs text-muted-foreground mt-1">assets tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.risk_profile ?? "Moderate"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Drift Alerts */}
      {drifts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Allocation Drift Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {drifts.map((d) => (
                <Badge key={d.asset_class} variant="destructive">
                  {d.label}: {d.current_pct.toFixed(1)}% (target: {d.target_pct}%)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={allocationData}
                  dataKey="value_usd"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ payload }: { payload?: { label?: string; current_pct?: number } }) => `${payload?.label ?? ""} ${(payload?.current_pct ?? 0).toFixed(1)}%`}
                >
                  {allocationData.map((entry) => (
                    <Cell key={entry.asset_class} fill={COLORS[entry.asset_class] ?? "#888"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0), "USD")}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Target vs Current */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current vs Target Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={allocationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${Number(v ?? 0).toFixed(1)}%`} />
                <Legend />
                <Bar dataKey="current_pct" name="Current" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target_pct" name="Target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Holdings Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {holdingsArr.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No holdings yet. Go to <a href="/holdings" className="text-primary underline">Holdings</a> to add your first asset.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Asset</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Price</th>
                    <th className="pb-2 font-medium text-right">Value</th>
                    <th className="pb-2 font-medium text-right">Day</th>
                    <th className="pb-2 font-medium text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsArr.slice(0, 10).map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{h.ticker}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {LABELS[h.asset_class] ?? h.asset_class}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">{Number(h.quantity).toLocaleString()}</td>
                      <td className="py-2 text-right">{formatCurrency(h.current_price_usd ?? 0, "USD")}</td>
                      <td className="py-2 text-right">{formatCurrency(h.current_value_usd ?? 0, "USD")}</td>
                      <td className={`py-2 text-right ${(h.day_change_pct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatPercentage(h.day_change_pct ?? 0)}
                      </td>
                      <td className={`py-2 text-right ${(h.pnl_pct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatPercentage(h.pnl_pct ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
