import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Holding, HoldingWithPrice, AssetPrice } from "@/types/database"
import { useAuth } from "@/contexts/AuthContext"

export function useHoldings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["holdings", user?.id],
    queryFn: async (): Promise<HoldingWithPrice[]> => {
      const { data: holdings, error } = await supabase
        .from("holdings")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Fetch prices for all holdings
      const tickers = (holdings || []).map((h: Holding) => h.ticker)
      const { data: prices } = await supabase
        .from("asset_prices")
        .select("*")
        .in("ticker", tickers)

      const priceMap = new Map<string, AssetPrice>()
      ;(prices || []).forEach((p: AssetPrice) => priceMap.set(p.ticker, p))

      return (holdings || []).map((h: Holding) => {
        const price = priceMap.get(h.ticker)
        const currentPriceUsd = price?.price_usd ?? 0
        const currentValueUsd = Number(h.quantity) * currentPriceUsd
        const costBasisUsd = Number(h.quantity) * Number(h.avg_buy_price)
        const pnlUsd = currentValueUsd - costBasisUsd

        return {
          ...h,
          current_price_usd: currentPriceUsd,
          current_price_inr: price?.price_inr ?? undefined,
          day_change_pct: price?.day_change_pct ?? undefined,
          current_value_usd: currentValueUsd,
          pnl_usd: pnlUsd,
          pnl_pct: costBasisUsd > 0 ? (pnlUsd / costBasisUsd) * 100 : 0,
        }
      })
    },
    enabled: !!user,
  })

  const addHolding = useMutation({
    mutationFn: async (holding: Omit<Holding, "id" | "user_id" | "created_at" | "updated_at" | "notes"> & { notes?: string }) => {
      const { data, error } = await supabase
        .from("holdings")
        .insert({ ...holding, user_id: user?.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holdings"] }),
  })

  const updateHolding = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Holding> & { id: string }) => {
      const { data, error } = await supabase
        .from("holdings")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holdings"] }),
  })

  const deleteHolding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holdings").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holdings"] }),
  })

  return { ...query, addHolding, updateHolding, deleteHolding }
}
