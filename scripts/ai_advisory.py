#!/usr/bin/env python3
"""
Hermes AI — AI Advisory Engine
Checks portfolio drift for all users. If drift exceeds threshold, calls
OpenRouter (primary: Nemotron 3 Ultra, free) or DeepSeek (fallback) to generate
structured rebalancing advice. Writes results to advisory_logs.

Usage:
    python scripts/ai_advisory.py
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ── AI Model Configuration ──────────────────────────────────────────

PRIMARY_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
FALLBACK_MODEL = "deepseek/deepseek-chat-v4-flash:free"

SYSTEM_PROMPT = """You are an expert multi-asset quantitative investment advisor running within the Hermes AI execution structure. Your goal is to analyze current asset drifts against target metrics.

When providing suggestions, separate outputs explicitly into two sections:

## SHORT-TERM TACTICAL ADJUSTMENTS
- Momentum tracking observations
- Trailing stop suggestions
- Immediate drift mitigation steps (specific buy/sell suggestions with reasoning)
- Risk alerts for over-concentrated positions

## LONG-TERM STRATEGIC REBALANCING PLAN
- Dollar-cost averaging pacing recommendations
- Compounding trajectory projections across indices
- Tax-harvesting notices for Indian standard tax cycles
- Macro-aware allocation shifts based on current drift

Format your response strictly in clean Markdown. Use bullet points and clear headings.
Keep advice actionable and specific. Reference actual percentages from the portfolio data provided.
Do not hallucinate data — only use the numbers provided.
End with a disclaimer: "⚠️ This is AI-generated analysis, not financial advice. Consult a qualified financial advisor before making investment decisions."
"""


def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def call_openrouter(payload: dict) -> Optional[str]:
    """Call OpenRouter API (primary: Nemotron 3 Ultra, free)."""
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set. Skipping AI advisory.")
        return None

    try:
        resp = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://hermes-ai.app",
                "X-Title": "Hermes AI Portfolio Advisor",
            },
            json={
                "model": PRIMARY_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, indent=2)},
                ],
                "max_tokens": 1500,
                "temperature": 0.7,
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens", 0)
        logger.info(f"OpenRouter: {tokens} tokens used (model: {PRIMARY_MODEL})")
        return content
    except Exception as e:
        logger.error(f"OpenRouter call failed: {e}")
        return None


def call_deepseek(payload: dict) -> Optional[str]:
    """Call DeepSeek API (fallback, cheap)."""
    if not DEEPSEEK_API_KEY:
        logger.warning("DEEPSEEK_API_KEY not set. Cannot fallback.")
        return None

    try:
        resp = httpx.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, indent=2)},
                ],
                "max_tokens": 1500,
                "temperature": 0.7,
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens", 0)
        logger.info(f"DeepSeek: {tokens} tokens used (model: deepseek-chat)")
        return content
    except Exception as e:
        logger.error(f"DeepSeek call failed: {e}")
        return None


def get_ai_advice(
    payload: dict, dry_run: bool = False
) -> tuple[Optional[str], Optional[str]]:
    """
    Try primary model, fallback if needed. Returns (advice_text, model_used).
    If dry_run=True, generates a mock advisory for testing.
    """
    if dry_run:
        logger.info("DRY RUN mode — generating mock advisory...")
        drifts = payload["portfolio_summary"].get("drift_details", {})
        violator = payload["portfolio_summary"].get("primary_violator", "Unknown")
        mock = f"""## SHORT-TERM TACTICAL ADJUSTMENTS

- **{violator}**: Immediate rebalancing recommended to reduce risk exposure
- Consider setting trailing stop-loss orders at 5-7% below current levels for over-allocated positions
- Momentum indicators suggest waiting for a pullback before adding to under-allocated classes
- Review stop-loss levels for all positions this week

## LONG-TERM STRATEGIC REBALANCING PLAN

- **Target Allocation**: Rebalance towards targets over the next 4-6 weeks using dollar-cost averaging
- For Indian equities: Consider tax-loss harvesting before March 31 fiscal year-end
- US equity under-allocation: Gradually increase exposure via index funds (VOO/VTI) over 3 tranches
- Crypto over-exposure: Trim positions in 25% increments weekly until target is reached
- Set a calendar reminder for quarterly rebalancing review

⚠️ This is AI-generated analysis, not financial advice. Consult a qualified financial advisor before making investment decisions.
"""
        return mock, "dry-run (mock)"

    # Try primary (free OpenRouter)
    advice = call_openrouter(payload)
    if advice:
        return advice, PRIMARY_MODEL

    # Try fallback (DeepSeek)
    logger.info("Primary failed. Trying fallback (DeepSeek)...")
    advice = call_deepseek(payload)
    if advice:
        return advice, FALLBACK_MODEL

    return None, None


def save_advisory(
    supabase: Client,
    user_id: str,
    horizon_type: str,
    trigger_reason: str,
    drift_details: dict,
    suggestion: str,
    model_used: str,
    tokens_used: int = 0,
):
    """Save AI advisory to database."""
    try:
        supabase.table("advisory_logs").insert(
            {
                "user_id": user_id,
                "horizon_type": horizon_type,
                "trigger_reason": trigger_reason,
                "drift_details": drift_details,
                "raw_suggestion": suggestion,
                "model_used": model_used,
                "tokens_used": tokens_used,
            }
        ).execute()
        logger.info(f"  Saved {horizon_type} advisory for user {user_id}")
    except Exception as e:
        logger.error(f"  Failed to save advisory: {e}")


def main():
    # Check for --dry-run flag
    dry_run = "--dry-run" in sys.argv

    supabase = get_supabase()
    logger.info("Starting AI Advisory check..." + (" [DRY RUN]" if dry_run else ""))

    # Get today's snapshot for all users
    today = datetime.utcnow().strftime("%Y-%m-%d")
    snapshots_resp = (
        supabase.table("portfolio_snapshots")
        .select("*")
        .eq("snapshot_date", today)
        .execute()
    )
    snapshots = snapshots_resp.data or []

    if not snapshots:
        logger.info("No snapshots for today. Run calculate_portfolio.py first.")
        return

    for snap in snapshots:
        user_id = snap["user_id"]
        total_value = float(snap["total_value_usd"])
        crypto_pct = float(snap["crypto_pct"] or 0)
        equity_in_pct = float(snap["equity_in_pct"] or 0)
        equity_us_pct = float(snap["equity_us_pct"] or 0)

        # Get user's targets and threshold
        profile_resp = (
            supabase.table("profiles")
            .select(
                "risk_profile,target_crypto,target_equity_in,target_equity_us,drift_threshold"
            )
            .eq("id", user_id)
            .execute()
        )
        profile = (profile_resp.data or [None])[0]
        if not profile:
            continue

        risk_profile = profile.get("risk_profile", "Moderate")
        targets = {
            "CRYPTO": float(profile.get("target_crypto", 10)),
            "EQUITY_IN": float(profile.get("target_equity_in", 50)),
            "EQUITY_US": float(profile.get("target_equity_us", 40)),
        }
        threshold = float(profile.get("drift_threshold", 5))

        # Calculate drift
        current = {
            "CRYPTO": crypto_pct,
            "EQUITY_IN": equity_in_pct,
            "EQUITY_US": equity_us_pct,
        }
        drifts = {}
        for cls_name, target in targets.items():
            delta = abs(current[cls_name] - target)
            if delta > threshold:
                drifts[cls_name] = {
                    "current_pct": round(current[cls_name], 2),
                    "target_pct": round(target, 2),
                    "delta_pct": round(delta, 2),
                }

        if not drifts:
            logger.info(f"User {user_id}: No drift exceeds {threshold}%. Skipping AI.")
            continue

        # Build the structured payload for AI
        primary_violator = max(drifts.items(), key=lambda x: x[1]["delta_pct"])
        payload = {
            "portfolio_summary": {
                "risk_profile": risk_profile,
                "total_value_usd": round(total_value, 2),
                "current_allocations": {
                    "CRYPTO": {
                        "current_pct": round(crypto_pct, 2),
                        "target_pct": targets["CRYPTO"],
                    },
                    "EQUITY_IN": {
                        "current_pct": round(equity_in_pct, 2),
                        "target_pct": targets["EQUITY_IN"],
                    },
                    "EQUITY_US": {
                        "current_pct": round(equity_us_pct, 2),
                        "target_pct": targets["EQUITY_US"],
                    },
                },
                "drift_detected": True,
                "drift_details": drifts,
                "primary_violator": f"{primary_violator[0]} (+{primary_violator[1]['delta_pct']}% deviation)",
                "drift_threshold": threshold,
            }
        }

        trigger_reason = (
            f"Weekly Rebalance Run — Drift Delta Exceeded ({', '.join(drifts.keys())})"
        )

        logger.info(f"User {user_id}: Drift detected — calling AI...")
        advice, model_used = get_ai_advice(payload, dry_run=dry_run)

        if advice:
            # Save as a combined advisory (both short-term and long-term)
            save_advisory(
                supabase,
                user_id,
                "COMBINED",
                trigger_reason,
                drifts,
                advice,
                model_used or "unknown",
            )
            logger.info(f"  Advisory saved ({len(advice)} chars)")
        else:
            logger.error(f"  Failed to get AI advice for user {user_id}")

        # Small delay between users to avoid rate limits
        time.sleep(1)

    logger.info("AI Advisory check complete.")


if __name__ == "__main__":
    main()
