#!/usr/bin/env python3
"""
Hermes AI — Fetch Prices Script
Fetches latest prices from yfinance (US + NSE) and CoinGecko (Crypto),
then upserts into Supabase asset_prices table.

Usage:
    python scripts/fetch_prices.py
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from typing import Optional

import httpx
import yfinance as yf
from dotenv import load_dotenv
from supabase import create_client, Client

# Load env
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # service_role key for writes

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# USD to INR rate (approximate, update periodically or use an API)
USD_INR_RATE = 85.0


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_us_equity(ticker: str) -> Optional[dict]:
    """Fetch price for a US equity ticker via yfinance."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.fast_info
        # fast_info gives: last_price, previous_close, etc.
        price = float(info.get("last_price", 0) or 0)
        prev_close = float(info.get("previous_close", 0) or 0)
        if price <= 0:
            # Fallback to history
            hist = stock.history(period="1d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[0]) if len(hist) > 1 else price

        change_pct = ((price - prev_close) / prev_close * 100) if prev_close > 0 else 0
        return {
            "ticker": ticker,
            "asset_class": "EQUITY_US",
            "price_usd": round(price, 6),
            "price_inr": round(price * USD_INR_RATE, 6),
            "day_change_pct": round(change_pct, 4),
            "fetched_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch US equity {ticker}: {e}")
        return None


def fetch_indian_equity(ticker: str) -> Optional[dict]:
    """Fetch price for an Indian equity ticker via yfinance .NS suffix."""
    try:
        # Ensure .NS suffix for NSE
        if not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"

        stock = yf.Ticker(ticker)
        # Try fast_info first
        try:
            info = stock.fast_info
            price = float(info.get("last_price", 0) or 0)
            prev_close = float(info.get("previous_close", 0) or 0)
        except Exception:
            price = 0
            prev_close = 0

        if price <= 0:
            hist = stock.history(period="1d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Open"].iloc[0]) if len(hist) > 1 else price

        if price <= 0:
            logger.warning(f"Could not fetch price for {ticker} via yfinance")
            return None

        # Price is in INR on NSE
        price_inr = price
        price_usd = price / USD_INR_RATE
        change_pct = ((price - prev_close) / prev_close * 100) if prev_close > 0 else 0

        return {
            "ticker": ticker.replace(".NS", ""),
            "asset_class": "EQUITY_IN",
            "price_usd": round(price_usd, 6),
            "price_inr": round(price_inr, 6),
            "day_change_pct": round(change_pct, 4),
            "fetched_at": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch Indian equity {ticker}: {e}")
        return None


def fetch_crypto_prices(tickers: list[str]) -> list[dict]:
    """Fetch crypto prices from CoinGecko free API in a single batch call."""
    results = []
    # CoinGecko uses IDs like 'bitcoin', 'ethereum', not tickers like 'BTC'
    # Map common tickers to CoinGecko IDs
    COINGECKO_MAP = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "BNB": "binancecoin",
        "XRP": "ripple",
        "ADA": "cardano",
        "DOGE": "dogecoin",
        "DOT": "polkadot",
        "MATIC": "matic-network",
        "TRX": "tron",
        "LTC": "litecoin",
        "AVAX": "avalanche-2",
        "LINK": "chainlink",
        "UNI": "uniswap",
        "ATOM": "cosmos",
    }

    coin_ids = []
    ticker_map = {}
    for t in tickers:
        cg_id = COINGECKO_MAP.get(t.upper(), t.lower())
        coin_ids.append(cg_id)
        ticker_map[cg_id] = t.upper()

    if not coin_ids:
        return results

    try:
        url = "https://api.coingecko.com/api/v3/simple/price"
        params = {
            "ids": ",".join(coin_ids),
            "vs_currencies": "usd,inr",
            "include_24hr_change": "true",
        }
        resp = httpx.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        for cg_id, prices in data.items():
            ticker = ticker_map.get(cg_id, cg_id.upper())
            price_usd = prices.get("usd", 0)
            price_inr = prices.get("inr", 0)
            change_pct = prices.get("usd_24h_change", 0) or 0

            results.append({
                "ticker": ticker,
                "asset_class": "CRYPTO",
                "price_usd": round(price_usd, 6),
                "price_inr": round(price_inr, 6),
                "day_change_pct": round(change_pct, 4),
                "fetched_at": datetime.utcnow().isoformat(),
            })
    except Exception as e:
        logger.warning(f"Failed to fetch crypto prices: {e}")

    return results


def upsert_prices(supabase: Client, prices: list[dict]):
    """Upsert prices into asset_prices table."""
    for p in prices:
        try:
            supabase.table("asset_prices").upsert(
                {
                    "ticker": p["ticker"],
                    "asset_class": p["asset_class"],
                    "price_usd": p["price_usd"],
                    "price_inr": p["price_inr"],
                    "day_change_pct": p["day_change_pct"],
                    "fetched_at": p["fetched_at"],
                },
                on_conflict="ticker,asset_class",
            ).execute()
        except Exception as e:
            logger.error(f"Failed to upsert price for {p['ticker']}: {e}")


def main():
    supabase = get_supabase()
    logger.info("Fetching all distinct tickers from holdings...")

    # Get all distinct tickers grouped by asset class
    resp = supabase.table("holdings").select("ticker,asset_class").execute()
    holdings = resp.data or []

    if not holdings:
        logger.info("No holdings found. Nothing to fetch.")
        return

    # Group by asset class
    crypto_tickers = []
    us_tickers = []
    in_tickers = []

    for h in holdings:
        ticker = h["ticker"].strip()
        asset_class = h["asset_class"]
        if asset_class == "CRYPTO":
            crypto_tickers.append(ticker)
        elif asset_class == "EQUITY_US":
            us_tickers.append(ticker)
        elif asset_class == "EQUITY_IN":
            in_tickers.append(ticker)

    logger.info(f"Found: {len(crypto_tickers)} crypto, {len(us_tickers)} US, {len(in_tickers)} Indian")

    all_prices = []

    # Fetch crypto (batch)
    if crypto_tickers:
        logger.info("Fetching crypto prices...")
        crypto_prices = fetch_crypto_prices(list(set(crypto_tickers)))
        all_prices.extend(crypto_prices)
        logger.info(f"  Fetched {len(crypto_prices)} crypto prices")

    # Fetch US equities
    for ticker in set(us_tickers):
        logger.info(f"Fetching US: {ticker}")
        price = fetch_us_equity(ticker)
        if price:
            all_prices.append(price)
        time.sleep(0.5)  # Rate limit

    # Fetch Indian equities
    for ticker in set(in_tickers):
        logger.info(f"Fetching IN: {ticker}")
        price = fetch_indian_equity(ticker)
        if price:
            all_prices.append(price)
        time.sleep(0.5)

    # Upsert all prices
    if all_prices:
        logger.info(f"Upserting {len(all_prices)} prices to Supabase...")
        upsert_prices(supabase, all_prices)
        logger.info("Done!")
    else:
        logger.warning("No prices fetched.")


if __name__ == "__main__":
    main()
