export interface Profile {
  id: string
  updated_at: string
  risk_profile: "Conservative" | "Moderate" | "Aggressive"
  target_crypto: number
  target_equity_in: number
  target_equity_us: number
  base_currency: "INR" | "USD"
  drift_threshold: number
}

export type AssetClass = "CRYPTO" | "EQUITY_IN" | "EQUITY_US"

export interface Holding {
  id: string
  user_id: string
  asset_class: AssetClass
  ticker: string
  quantity: number
  avg_buy_price: number
  buy_currency: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AssetPrice {
  id: string
  ticker: string
  asset_class: AssetClass
  price_usd: number
  price_inr: number | null
  day_change_pct: number | null
  fetched_at: string
}

export type HorizonType = "SHORT_TERM" | "LONG_TERM" | "COMBINED"

export interface AdvisoryLog {
  id: string
  user_id: string
  horizon_type: HorizonType
  trigger_reason: string
  drift_details: Record<string, unknown> | null
  raw_suggestion: string
  model_used: string | null
  tokens_used: number | null
  created_at: string
}

export interface PortfolioSnapshot {
  id: string
  user_id: string
  total_value_usd: number
  total_value_inr: number | null
  crypto_pct: number | null
  equity_in_pct: number | null
  equity_us_pct: number | null
  snapshot_date: string
}

export interface HoldingWithPrice extends Holding {
  current_price_usd?: number
  current_price_inr?: number
  day_change_pct?: number
  current_value_usd?: number
  current_value_inr?: number
  pnl_usd?: number
  pnl_inr?: number
  pnl_pct?: number
}

export interface AllocationData {
  asset_class: AssetClass
  label: string
  current_pct: number
  target_pct: number
  value_usd: number
  value_inr: number
}
