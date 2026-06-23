-- Hermes AI: Initial Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: profiles
-- Tied to Supabase auth.users via trigger
-- ============================================
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at      TIMESTAMPTZ DEFAULT now(),
    risk_profile    TEXT DEFAULT 'Moderate'
                    CHECK (risk_profile IN ('Conservative', 'Moderate', 'Aggressive')),
    target_crypto   NUMERIC(5,2) DEFAULT 10.0,
    target_equity_in NUMERIC(5,2) DEFAULT 50.0,
    target_equity_us NUMERIC(5,2) DEFAULT 40.0,
    base_currency   TEXT DEFAULT 'INR'
                    CHECK (base_currency IN ('INR', 'USD')),
    drift_threshold NUMERIC(5,2) DEFAULT 5.0
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id) VALUES (new.id);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Table: holdings
-- ============================================
CREATE TABLE public.holdings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    asset_class     TEXT NOT NULL CHECK (asset_class IN ('CRYPTO', 'EQUITY_IN', 'EQUITY_US')),
    ticker          TEXT NOT NULL,
    quantity        NUMERIC(20,8) NOT NULL DEFAULT 0.0,
    avg_buy_price   NUMERIC(20,4) NOT NULL DEFAULT 0.0,
    buy_currency    TEXT DEFAULT 'INR',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_holdings_user ON holdings(user_id);
CREATE INDEX idx_holdings_class ON holdings(user_id, asset_class);

-- ============================================
-- Table: asset_prices
-- ============================================
CREATE TABLE public.asset_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker          TEXT NOT NULL,
    asset_class     TEXT NOT NULL,
    price_usd       NUMERIC(20,6) NOT NULL,
    price_inr       NUMERIC(20,6),
    day_change_pct  NUMERIC(10,4),
    fetched_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ticker, asset_class)
);

CREATE INDEX idx_prices_ticker ON asset_prices(ticker);

-- ============================================
-- Table: advisory_logs
-- ============================================
CREATE TABLE public.advisory_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    horizon_type    TEXT NOT NULL CHECK (horizon_type IN ('SHORT_TERM', 'LONG_TERM', 'COMBINED')),
    trigger_reason  TEXT NOT NULL,
    drift_details   JSONB,
    raw_suggestion  TEXT NOT NULL,
    model_used      TEXT,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_advisory_user ON advisory_logs(user_id, created_at DESC);

-- ============================================
-- Table: portfolio_snapshots
-- ============================================
CREATE TABLE public.portfolio_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    total_value_usd NUMERIC(20,4) NOT NULL,
    total_value_inr NUMERIC(20,4),
    crypto_pct      NUMERIC(5,2),
    equity_in_pct   NUMERIC(5,2),
    equity_us_pct   NUMERIC(5,2),
    snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(user_id, snapshot_date)
);

CREATE INDEX idx_snapshots_user_date ON portfolio_snapshots(user_id, snapshot_date DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- holdings
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own holdings" ON public.holdings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own holdings" ON public.holdings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own holdings" ON public.holdings
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own holdings" ON public.holdings
    FOR DELETE USING (auth.uid() = user_id);

-- advisory_logs (read-only for owner, insert by service role)
ALTER TABLE public.advisory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own advisories" ON public.advisory_logs
    FOR SELECT USING (auth.uid() = user_id);

-- portfolio_snapshots (read-only for owner)
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own snapshots" ON public.portfolio_snapshots
    FOR SELECT USING (auth.uid() = user_id);

-- asset_prices (public read, service role write)
ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read prices" ON public.asset_prices
    FOR SELECT USING (true);
