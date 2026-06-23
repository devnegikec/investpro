# Hermes AI — Technical Architecture & MVP Plan

> **Status**: Approved for Implementation  
> **Date**: June 2026  
> **Stack**: React, TypeScript, Supabase, Python, OpenRouter AI, Cloudflare Pages

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Recommended Tech Stack (vs PRD)](#2-recommended-tech-stack-vs-prd)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [MVP Scope Definition](#5-mvp-scope-definition)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Risk Register & Mitigations](#7-risk-register--mitigations)
8. [Cost Analysis](#8-cost-analysis)
9. [Post-MVP Roadmap](#9-post-mvp-roadmap)

---

## 1. Executive Summary

The **Hermes AI** platform is a zero-cost, multi-asset portfolio tracking and AI-powered advisory system. It tracks **Crypto**, **Indian Equities (NSE)**, and **US Equities (NYSE/NASDAQ)** in a single unified dashboard, with asynchronous AI rebalancing suggestions triggered only when portfolio drift exceeds configured thresholds.

### What the PRD Gets Right

- Supabase as the all-in-one backend (DB + Auth + Realtime + RLS) is an excellent choice
- React + TypeScript + Vite + Tailwind + shadcn/ui is the current best practice
- Threshold-based AI triggering (not constant polling) is smart token-efficiency
- Structured JSON payloads to the LLM (not raw tables) is the right approach

### What We're Improving

| PRD Choice | Our Recommendation | Why |
|-----------|-------------------|-----|
| Vercel/Netlify | **Cloudflare Pages** | Unlimited bandwidth (free) vs 100 GB cap |
| Hermes 3 / Ollama local | **OpenRouter Nemotron 3 Ultra (free)** | Stronger model, zero hardware dependency |
| yfinance only for NSE | **yfinance `.NS` primary + nsepython fallback** | More reliable than scraping NSE directly |
| GitHub Actions | **GitHub Actions** (kept) | Best free cron, public repo = 3000 min/month |
| Recharts only | **Recharts + Tremor KPI cards** | Pre-built portfolio metric cards |

---

## 2. Recommended Tech Stack

### Frontend

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| Framework | **Vite + React 18** | SPA is correct for a dashboard. Next.js adds complexity without benefit. |
| Language | **TypeScript** | Non-negotiable |
| CSS | **Tailwind CSS v3.4** | Pin v3.4 for stability |
| UI Library | **shadcn/ui** | Best React UI library in 2026 |
| Charts | **Recharts** + **Tremor** | Tremor for KPI/metric cards, Recharts for charts |
| State | **TanStack Query v5** + **Zustand v5** | Industry standard combo |
| Routing | **React Router v7** | Standard SPA routing |

### Backend & Database

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| Database | **Supabase PostgreSQL** | All-in-one: DB + Auth + Realtime + Storage |
| Auth | **Supabase Auth** (email + Google OAuth) | Built-in, free, RLS-ready |
| ORM | **Drizzle ORM** (Python pipeline) | Type-safe schema for scripts |

### Data Pipelines

| Source | Choice | Reasoning |
|--------|--------|-----------|
| US Equities | **yfinance** (cached) | Free, covers all US stocks |
| Indian Equities | **yfinance `.NS`** primary + **nsepython** fallback | More reliable dual-source |
| Crypto | **CoinGecko Demo API** (10K credits/mo) | `/simple/price` batch endpoint = 1 credit for all |

### AI Engine

| Tier | Model | Cost |
|------|-------|------|
| Primary | **NVIDIA Nemotron 3 Ultra** via OpenRouter | **$0** (free tier) |
| Fallback 1 | **DeepSeek V4 Flash** | ~$0.14/M input |
| Fallback 2 | **Groq GPT-OSS 120B** | Free eval tier |

### Automation & Deployment

| Component | Choice | Reasoning |
|-----------|--------|-----------|
| Cron | **GitHub Actions** | Free with public repo (3000 min/month) |
| Frontend | **Cloudflare Pages** | Unlimited bandwidth (free) |
| Pipeline | **GitHub Actions** (co-located) | No separate deployment needed |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React SPA (Vite + TypeScript)                            │  │
│  │  TanStack Query v5  │  Zustand v5  │  Recharts + Tremor  │  │
│  │  Supabase JS Client (auth + realtime + RLS)               │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE PAGES (CDN)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE (Backend)                         │
│  Auth (JWT)  │  PostgreSQL (RLS)  │  PostgREST  │  Realtime     │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                             │
┌─────────────────────────────────────────────────────────────────┐
│                 GITHUB ACTIONS (Daily Cron)                       │
│  Python 3.12 Pipeline:                                           │
│  1. Fetch: yfinance + CoinGecko                                 │
│  2. Compute: Δ = |current - target|                              │
│  3. Store prices → Supabase                                      │
│  4. If Δ > 5%: OpenRouter AI → advisory_logs                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### Tables

**profiles** — User settings tied to Supabase Auth
- `id` UUID PK → auth.users
- `risk_profile` TEXT ('Conservative','Moderate','Aggressive')
- `target_crypto` NUMERIC, `target_equity_in` NUMERIC, `target_equity_us` NUMERIC
- `drift_threshold` NUMERIC DEFAULT 5.0

**holdings** — Portfolio positions
- `id` UUID PK, `user_id` UUID FK → profiles
- `asset_class` TEXT ('CRYPTO','EQUITY_IN','EQUITY_US')
- `ticker` TEXT, `quantity` NUMERIC(20,8), `avg_buy_price` NUMERIC(20,4)

**asset_prices** — Cached latest prices
- `ticker` TEXT, `asset_class` TEXT, `price_usd` NUMERIC, `price_inr` NUMERIC
- `day_change_pct` NUMERIC, `fetched_at` TIMESTAMPTZ
- UNIQUE(ticker, asset_class)

**advisory_logs** — AI-generated advice
- `id` UUID PK, `user_id` UUID FK → profiles
- `horizon_type` TEXT ('SHORT_TERM','LONG_TERM','COMBINED')
- `trigger_reason` TEXT, `drift_details` JSONB
- `raw_suggestion` TEXT (Markdown), `model_used` TEXT

**portfolio_snapshots** — Daily value history
- `user_id` UUID, `total_value_usd` NUMERIC, `crypto_pct`, `equity_in_pct`, `equity_us_pct`
- `snapshot_date` DATE, UNIQUE(user_id, snapshot_date)

### RLS: All tables enforce `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.

---

## 5. MVP Scope

### 🟢 MUST-HAVE (MVP — 4-6 Weeks)

1. Supabase Auth (email + Google OAuth)
2. Manual Portfolio Entry (add/edit/delete holdings)
3. Portfolio Dashboard (table: symbol, qty, price, P&L, allocation %)
4. Daily Price Refresh (GitHub Actions cron: yfinance + CoinGecko)
5. Asset Allocation Pie Chart (Recharts: current vs target)
6. Target Allocation Settings (user sets % per asset class)
7. Drift Detection (>5%) — notification banner
8. Row Level Security on all tables
9. Mobile-Responsive UI (Tailwind)
10. Deploy to Cloudflare Pages

### 🟡 SHOULD-HAVE (v1.1)

11. AI Advisory (Nemotron 3 Ultra via OpenRouter, drift-triggered)
12. Advisory History Log (expandable Markdown)
13. Manual "Run Diagnostic" button
14. Price Sparklines (7d mini charts)
15. Portfolio Value History chart
16. Bulk CSV Import
17. Currency Toggle (INR/USD)
18. Email Notifications (drift alerts via Resend)

### 🔵 NICE-TO-HAVE (v2)

19. Broker Sync (Zerodha, Alpaca, Plaid)
20. Tax-Loss Harvesting
21. Multiple Portfolios per User
22. Advanced AI Models
23. Backtesting Engine
24. PWA / Mobile App

---

## 6. Implementation Roadmap

### Phase 0: Project Setup (Days 1-2)
- GitHub repo, Supabase project, DB migrations, RLS
- Vite + React + TypeScript scaffold, dependencies
- Tailwind CSS v3.4, shadcn/ui init
- Core files: supabase client, auth context, types

### Phase 1: Core Dashboard (Days 3-7)
- Auth pages (login/signup), protected routes
- Holdings CRUD (table + modal form)
- Dashboard overview (KPI cards + allocation chart)

### Phase 2: Data Pipeline (Days 8-11)
- Python scripts: fetch_prices.py, calculate_portfolio.py
- GitHub Actions daily cron workflow
- Drift detection display in UI

### Phase 3: AI Advisory (Days 12-15)
- ai_advisory.py (OpenRouter + DeepSeek fallback)
- Update cron workflow for conditional AI
- Advisor Center UI + history log

### Phase 4: Polish & Deploy (Days 16-21)
- Dark mode, loading skeletons, error states
- Responsive testing, accessibility
- Cloudflare Pages deployment
- E2E testing

---

## 7. Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | yfinance breaks (Yahoo API changes) | High | Retry logic + cache + Twelve Data fallback |
| R2 | CoinGecko rate limits | Medium | Batch endpoint (1 credit = all coins), cache |
| R3 | Supabase pauses (1 week inactive) | Medium | Daily cron writes = constant activity |
| R4 | OpenRouter free model removed | Medium | DeepSeek fallback + circuit breaker |
| R5 | nsepython breaks | Medium | yfinance `.NS` is primary; nsepython is fallback |
| R6 | RLS misconfiguration (data leak) | High | E2E test: User A can't see User B's data |
| R7 | AI hallucinations (bad advice) | Medium | Strong system prompt + disclaimer + audit logs |

---

## 8. Cost Analysis

### MVP: $0–$1/month

| Service | Plan | Cost |
|---------|------|------|
| Cloudflare Pages | Free | $0 (unlimited bandwidth) |
| Supabase | Free | $0 (500 MB DB, 50K MAU) |
| GitHub Actions | Free (public) | $0 (3000 min/month) |
| CoinGecko | Demo | $0 (10K credits) |
| yfinance + nsepython | Free | $0 |
| OpenRouter | Free (Nemotron 3) | $0 |
| DeepSeek fallback | Pay-as-you-go | ~$1 |
| **TOTAL** | | **$0–$1** |

### Post-MVP (100+ users): ~$134/month
(Twelve Data Grow $79 + Supabase Pro $25 + Vercel Pro $20 + DeepSeek Pro ~$10)

---

## 9. Post-MVP Roadmap

- **v1.1** (Weeks 7-10): AI Advisory full, portfolio history charts, email alerts, CSV import
- **v1.2** (Weeks 11-14): Twelve Data reliable data, real-time price updates, price alerts
- **v2.0** (Months 4-6): Broker integrations, tax-loss harvesting, multiple portfolios, PWA

---

## 10. Project Structure

```
hermes-ai/
├── .github/workflows/
│   └── daily-pipeline.yml
├── scripts/
│   ├── requirements.txt
│   ├── fetch_prices.py
│   ├── calculate_portfolio.py
│   └── ai_advisory.py
├── supabase/migrations/
│   └── 001_initial_schema.sql
├── src/
│   ├── components/
│   │   ├── ui/            # shadcn/ui
│   │   ├── layout/        # AppShell, ProtectedRoute
│   │   ├── dashboard/     # PortfolioOverview, AllocationChart, DriftAlert, KpiCards
│   │   ├── holdings/      # HoldingsTable, AddHoldingModal, HoldingsFilter
│   │   └── advisor/       # AdvisorCenter, AdvisoryCard, AdvisoryHistory
│   ├── contexts/          # AuthContext
│   ├── hooks/             # useHoldings, usePrices, useAdvisoryLogs, etc.
│   ├── lib/               # supabase client, utils
│   ├── pages/             # Login, Signup, Dashboard, Holdings, Advisor, Settings
│   ├── providers/         # QueryProvider
│   ├── stores/            # uiStore (Zustand)
│   ├── types/             # database.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

---

**End of Architecture Plan. Ready for implementation.**
