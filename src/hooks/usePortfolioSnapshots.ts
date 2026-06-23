import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { PortfolioSnapshot } from "@/types/database"
import { useAuth } from "@/contexts/AuthContext"

export function usePortfolioSnapshots(days = 30) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["snapshots", user?.id, days],
    queryFn: async (): Promise<PortfolioSnapshot[]> => {
      const date = new Date()
      date.setDate(date.getDate() - days)
      const { data, error } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .eq("user_id", user?.id)
        .gte("snapshot_date", date.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}
