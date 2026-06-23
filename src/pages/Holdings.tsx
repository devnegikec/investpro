import { useState } from "react"
import { useHoldings } from "@/hooks/useHoldings"
import { useUIStore } from "@/stores/uiStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatPercentage } from "@/lib/utils"
import type { AssetClass } from "@/types/database"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"

const CLASS_LABELS: Record<AssetClass, string> = {
  CRYPTO: "Crypto",
  EQUITY_IN: "Indian Equity",
  EQUITY_US: "US Equity",
}

export default function HoldingsPage() {
  const { data: holdings, isLoading, addHolding, updateHolding, deleteHolding } = useHoldings()
  const assetClassFilter = useUIStore((s) => s.assetClassFilter)
  const setAssetClassFilter = useUIStore((s) => s.setAssetClassFilter)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [ticker, setTicker] = useState("")
  const [assetClass, setAssetClass] = useState<AssetClass>("EQUITY_US")
  const [quantity, setQuantity] = useState("")
  const [avgBuyPrice, setAvgBuyPrice] = useState("")

  const filtered = assetClassFilter === "ALL"
    ? (holdings ?? [])
    : (holdings ?? []).filter((h) => h.asset_class === assetClassFilter)

  const resetForm = () => {
    setTicker("")
    setAssetClass("EQUITY_US")
    setQuantity("")
    setAvgBuyPrice("")
    setEditingId(null)
  }

  const openEdit = (h: (typeof filtered)[number]) => {
    setTicker(h.ticker)
    setAssetClass(h.asset_class)
    setQuantity(String(h.quantity))
    setAvgBuyPrice(String(h.avg_buy_price))
    setEditingId(h.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ticker: ticker.toUpperCase(),
      asset_class: assetClass,
      quantity: Number(quantity),
      avg_buy_price: Number(avgBuyPrice),
      buy_currency: "USD",
    }

    if (editingId) {
      await updateHolding.mutateAsync({ id: editingId, ...payload })
    } else {
      await addHolding.mutateAsync(payload)
    }

    resetForm()
    setDialogOpen(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Holdings</h1>
          <p className="text-muted-foreground">Manage your portfolio positions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm() }}>
          <DialogTrigger>
            <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Holding
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Holding" : "Add Holding"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Ticker</Label>
                <Input
                  placeholder="e.g. AAPL, RELIANCE.NS, BTC"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Asset Class</Label>
                <Select value={assetClass} onValueChange={(v) => setAssetClass(v as AssetClass)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRYPTO">Crypto</SelectItem>
                    <SelectItem value="EQUITY_IN">Indian Equity</SelectItem>
                    <SelectItem value="EQUITY_US">US Equity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Avg Buy Price (USD)</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={avgBuyPrice}
                  onChange={(e) => setAvgBuyPrice(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={addHolding.isPending || updateHolding.isPending}>
                {(addHolding.isPending || updateHolding.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingId ? "Update" : "Add"} Holding
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["ALL", "CRYPTO", "EQUITY_IN", "EQUITY_US"] as const).map((f) => (
          <Button
            key={f}
            variant={assetClassFilter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setAssetClassFilter(f)}
          >
            {f === "ALL" ? "All" : CLASS_LABELS[f as AssetClass]}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              No holdings found. Click &quot;Add Holding&quot; to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Ticker</th>
                    <th className="p-3 font-medium">Class</th>
                    <th className="p-3 font-medium text-right">Qty</th>
                    <th className="p-3 font-medium text-right">Buy Price</th>
                    <th className="p-3 font-medium text-right">Current</th>
                    <th className="p-3 font-medium text-right">Value</th>
                    <th className="p-3 font-medium text-right">Day</th>
                    <th className="p-3 font-medium text-right">P&L</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{h.ticker}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{CLASS_LABELS[h.asset_class]}</Badge>
                      </td>
                      <td className="p-3 text-right">{Number(h.quantity).toLocaleString()}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(h.avg_buy_price), "USD")}</td>
                      <td className="p-3 text-right">{formatCurrency(h.current_price_usd ?? 0, "USD")}</td>
                      <td className="p-3 text-right">{formatCurrency(h.current_value_usd ?? 0, "USD")}</td>
                      <td className={`p-3 text-right ${(h.day_change_pct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatPercentage(h.day_change_pct ?? 0)}
                      </td>
                      <td className={`p-3 text-right font-medium ${(h.pnl_pct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatPercentage(h.pnl_pct ?? 0)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(h)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteHolding.mutate(h.id)}
                            disabled={deleteHolding.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
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
