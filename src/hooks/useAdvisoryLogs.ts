import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { AdvisoryLog } from "@/types/database"
import { useAuth } from "@/contexts/AuthContext"

export function useAdvisoryLogs() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["advisory_logs", user?.id],
    queryFn: async (): Promise<AdvisoryLog[]> => {
      const { data, error } = await supabase
        .from("advisory_logs")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}
