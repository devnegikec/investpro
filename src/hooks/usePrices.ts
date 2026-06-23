import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { AssetPrice } from "@/types/database"

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: async (): Promise<AssetPrice[]> => {
      const { data, error } = await supabase
        .from("asset_prices")
        .select("*")
        .order("fetched_at", { ascending: false })

      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000, // 5 min
  })
}
