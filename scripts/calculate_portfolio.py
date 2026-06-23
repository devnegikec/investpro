#!/usr/bin/env python3
"""
Hermes AI — Portfolio Calculator
Computes portfolio allocations, drift from targets, and writes daily snapshots.

Usage:
    python scripts/calculate_portfolio.py
"""

import os
import sys
import logging
from datetime import date
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

TARGET_DEFAULTS = {"CRYPTO": 10.0, "EQUITY_IN": 50.0, "EQUITY_US": 40.0}
DRIFT_THRESHOLD_DEFAULT = 5.0


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def main():
    supabase = get_supabase()
    today = date.today().isoformat()
    logger.info(f"Calculating portfolio snapshot for {today}")

    # Get all users with profiles
    profiles_resp = supabase.table("profiles").select("id,target_crypto,target_equity_in,target_equity_us,drift_threshold").execute()
    profiles = profiles_resp.data or []

    if not profiles:
        logger.info("No profiles found. Skipping.")
        return

    for profile in profiles:
        user_id = profile["id"]
        logger.info(f"Processing user: {user_id}")

        # Get holdings for this user
        holdings_resp = supabase.table("holdings").select("asset_class,quantity,ticker").eq("user_id", user_id).execute()
        holdings = holdings_resp.data or []

        if not holdings:
            logger.info(f"  No holdings for user {user_id}")
            continue

        # Get prices for user's tickers
        tickers = [h["ticker"] for h in holdings]
        prices_resp = supabase.table("asset_prices").select("ticker,price_usd,price_inr").in_("ticker", tickers).execute()
        prices = {p["ticker"]: p for p in (prices_resp.data or [])}

        # Calculate total value and per-class allocation
        class_values = {"CRYPTO": 0.0, "EQUITY_IN": 0.0, "EQUITY_US": 0.0}
        total_value_usd = 0.0

        for h in holdings:
            ticker = h["ticker"]
            qty = float(h["quantity"])
            price = prices.get(ticker)
            if price:
                value_usd = qty * float(price["price_usd"])
                class_values[h["asset_class"]] += value_usd
                total_value_usd += value_usd

        if total_value_usd <= 0:
            logger.info(f"  Total value is zero for user {user_id}")
            continue

        # Compute percentages
        crypto_pct = (class_values["CRYPTO"] / total_value_usd) * 100
        equity_in_pct = (class_values["EQUITY_IN"] / total_value_usd) * 100
        equity_us_pct = (class_values["EQUITY_US"] / total_value_usd) * 100

        total_value_inr = total_value_usd * 85.0  # approximate

        # Insert snapshot
        try:
            supabase.table("portfolio_snapshots").upsert(
                {
                    "user_id": user_id,
                    "total_value_usd": round(total_value_usd, 4),
                    "total_value_inr": round(total_value_inr, 4),
                    "crypto_pct": round(crypto_pct, 2),
                    "equity_in_pct": round(equity_in_pct, 2),
                    "equity_us_pct": round(equity_us_pct, 2),
                    "snapshot_date": today,
                },
                on_conflict="user_id,snapshot_date",
            ).execute()
            logger.info(f"  Snapshot saved: ${total_value_usd:,.2f} | C:{crypto_pct:.1f}% IN:{equity_in_pct:.1f}% US:{equity_us_pct:.1f}%")
        except Exception as e:
            logger.error(f"  Failed to save snapshot for {user_id}: {e}")

        # Check drift
        targets = {
            "CRYPTO": float(profile.get("target_crypto") or TARGET_DEFAULTS["CRYPTO"]),
            "EQUITY_IN": float(profile.get("target_equity_in") or TARGET_DEFAULTS["EQUITY_IN"]),
            "EQUITY_US": float(profile.get("target_equity_us") or TARGET_DEFAULTS["EQUITY_US"]),
        }
        threshold = float(profile.get("drift_threshold") or DRIFT_THRESHOLD_DEFAULT)

        drifts = []
        for cls_name, label in [("CRYPTO", "Crypto"), ("EQUITY_IN", "Indian Equity"), ("EQUITY_US", "US Equity")]:
            current = {"CRYPTO": crypto_pct, "EQUITY_IN": equity_in_pct, "EQUITY_US": equity_us_pct}[cls_name]
            target = targets[cls_name]
            delta = abs(current - target)
            if delta > threshold:
                drifts.append(f"{label}: {current:.1f}% (target {target:.1f}%, delta {delta:.1f}%)")

        if drifts:
            logger.info(f"  ⚠️ DRIFT DETECTED: {'; '.join(drifts)}")
        else:
            logger.info(f"  ✅ All allocations within {threshold}% threshold")

    logger.info("Portfolio calculation complete.")


if __name__ == "__main__":
    main()
