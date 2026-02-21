"""
adaptive_risk_engine.py
========================
Remapper built directly from anchors — no score_remapper.pkl needed.

Decision flow:
  Clear Human    ML~0.10  + boost 0   → final ~10   → ALLOW
  Confused Human ML~0.50  + boost 0   → final ~50   → SOFT_CAPTCHA
  Stealth Bot    ML~0.50  + boost +20 → final ~70   → HARD_CAPTCHA
  Clear Bot      ML~0.87  + boost +20 → final ~100  → BLOCK

Heuristics separate Confused Human from Stealth Bot since the ML model
outputs ~0.50 for both (identical feature distributions by design).
"""

import joblib
import numpy as np
import pandas as pd
from remapper import PiecewiseLinearRemapper
from redis_state import RedisState


class AdaptiveRiskEngine:

    def __init__(self,
                 model_path="model.pkl",
                 scaler_path="scaler.pkl",
                 feature_order_path="feature_order.pkl",
                 remapper_path=None):   # remapper_path kept for API compat, unused

        self.model         = joblib.load(model_path)
        self.scaler        = joblib.load(scaler_path)
        self.feature_order = joblib.load(feature_order_path)
        self.redis         = RedisState()

        # Built directly — no pkl load, no pickle module errors
        # Anchors: (raw_prob → target_prob)
        #   Clear Human  raw ~0.03–0.05  → mapped 0.07–0.15
        #   Overlap      raw ~0.47–0.54  → mapped 0.30–0.70 (identity at 0.50)
        #   Clear Bot    raw ~0.95–0.98  → mapped 0.82–0.93
        self.remapper = PiecewiseLinearRemapper([
            (0.00, 0.03),
            (0.04, 0.10),
            (0.10, 0.20),
            (0.20, 0.25),
            (0.35, 0.30),
            (0.50, 0.50),
            (0.65, 0.70),
            (0.80, 0.75),
            (0.90, 0.80),
            (0.96, 0.87),
            (1.00, 0.97),
        ])

        # Base thresholds (before dynamic adjustment)
        #
        # Decision band mapping:
        #   Clear Human     score ~10        → ALLOW        (< base_allow=25)
        #   Confused Human  score ~30–55     → SOFT_CAPTCHA (< base_soft=62)
        #   Stealth Bot     score ~50+20=70  → HARD_CAPTCHA (< base_hard=80)
        #   Clear Bot       score ~87+20=100 → BLOCK
        #
        # base_soft MUST sit above the confused human ceiling (~55) so that
        # even during moderate attacks the dynamic threshold stays above 55.
        # e.g. attack_intensity=0.32 → dynamic_soft = 62-(0.32×5) = 60.4 ✓
        # OLD value 48 was wrong: score 48.27 > dynamic_soft 44.78 → HARD (bug)
        self.base_allow = 25   # scores below this → ALLOW
        self.base_soft  = 62   # scores below this → SOFT_CAPTCHA  (fixed: was 48)
        self.base_hard  = 80   # scores below this → HARD_CAPTCHA
        self.decay_rate = 0.95

    # ----------------------------------
    # Score Remapping
    # Maps raw P(bot) into target bands:
    #   Clear Human     → 0.05–0.20
    #   Confused Human  → 0.30–0.55
    #   Stealth Bot     → 0.45–0.70
    #   Clear Bot       → 0.75–0.95
    # ----------------------------------
    def remap_score(self, raw_prob: float) -> float:
        return self.remapper.transform(raw_prob)

    # ----------------------------------
    # Update Attack Intensity
    # ----------------------------------
    def update_attack_intensity(self, latest_score):
        current  = self.redis.get_attack_intensity()
        current *= self.decay_rate
        current += latest_score / 150
        current  = min(1, current)
        self.redis.set_attack_intensity(float(current))
        return current

    # ----------------------------------
    # Exploit Protection Layer
    # ----------------------------------
    def protection_boost(self, session):
        """
        Heuristic boosts that separate Confused Human (~no boost)
        from Stealth Bot (~+20) since ML score is ~0.50 for both.

        Confused Human profile:  burstScore ~0.38, clickRandomness ~0.48,
                                 avgTypingSpeed ~12, typingVariance ~1.8,
                                 rpm ~11, sessionRequestCount ~62
        Stealth Bot profile:     burstScore ~0.52, clickRandomness ~0.35,
                                 avgTypingSpeed ~15, typingVariance ~1.2,
                                 rpm ~14.5, sessionRequestCount ~88
        """
        boost = 0

        # High request volume — strong bot signal
        if session["sessionRequestCount"] > 150:
            boost += 10

        # Burst + low click randomness — stealth bot combo
        # Stealth:  burstScore=0.52, clickRandomness=0.35 → triggers
        # Confused: burstScore=0.38, clickRandomness=0.48 → misses
        if session["burstScore"] > 0.45 and session["clickRandomnessScore"] < 0.45:
            boost += 12

        # Fast typing + low variance — mechanical pattern
        # Stealth:  avgSpeed=15.1, variance=1.2 → triggers
        # Confused: avgSpeed=12.4, variance=1.8 → misses
        if session["typingVariance"] < 0.9 and session["avgTypingSpeed"] > 13:
            boost += 8

        # High RPM + low randomness — sustained automated traffic
        # Stealth:  rpm=14.5, clickRandomness=0.35 → triggers
        # Confused: rpm=11.2, clickRandomness=0.48 → misses
        if session["requestsPerMinute"] > 12 and session["clickRandomnessScore"] < 0.45:
            boost += 6

        return min(boost, 20)   # cap raised from 12 to 20

    # ----------------------------------
    # MAIN RISK FUNCTION
    # ----------------------------------
    def calculate_risk(self, session_dict, user_id="anonymous"):

        df      = pd.DataFrame([session_dict])
        epsilon = 1e-6

        # Derived features
        df["typingConsistency"]    = df["avgTypingSpeed"]    / (df["typingVariance"] + epsilon)
        df["movementEfficiency"]   = df["mousePathLength"]   / (df["mouseMoveCount"] + epsilon)
        df["interactionIntensity"] = df["mouseMoveCount"]    + df["sessionRequestCount"]
        df["trafficPressure"]      = df["requestsPerMinute"] * df["burstScore"]

        honeypot_flag = df["honeypotTriggered"].values[0]

        # ------------------------------
        # HARD HONEYPOT — instant block
        # ------------------------------
        if honeypot_flag == 1:
            final_score      = 100.0
            attack_intensity = self.update_attack_intensity(final_score)
            trust_score      = self.redis.get_user_trust(user_id)
            trust_score      = max(-50, min(50, trust_score - 5))
            self.redis.set_user_trust(user_id, int(trust_score))
            return {
                "final_risk_score": final_score,
                "attack_intensity": float(attack_intensity),
                "user_trust":       trust_score,
                "decision":         "BLOCK"
            }

        # ------------------------------
        # ML SCORE
        # ------------------------------
        df_ml  = df.drop(["honeypotTriggered"], axis=1)
        df_ml  = df_ml[self.feature_order]
        scaled = self.scaler.transform(df_ml)

        # Raw P(bot) from calibrated XGBoost
        bot_prob_raw = self.model.predict_proba(scaled)[0][0]

        # ── REMAPPING LAYER ──────────────────────────────────────
        # Maps raw probability into target bands before scoring.
        #   Before: Clear Human ~0.03, Clear Bot ~0.96
        #   After:  Clear Human ~0.10, Clear Bot ~0.87
        bot_prob = self.remap_score(bot_prob_raw)
        # ─────────────────────────────────────────────────────────

        final_score = float(bot_prob * 100)

        # Heuristic boost — separates Stealth Bot from Confused Human
        final_score += self.protection_boost(session_dict)

        # Trust adjustment — penalises known bots, rewards known humans
        trust_score  = self.redis.get_user_trust(user_id)
        final_score -= trust_score * 0.5
        final_score  = max(0, min(100, final_score))

        attack_intensity = self.update_attack_intensity(final_score)

        # Update trust memory
        if final_score < 25:
            trust_score += 2
        elif final_score > 70:
            trust_score -= 2
        trust_score = max(-50, min(50, trust_score))
        self.redis.set_user_trust(user_id, int(trust_score))

        # Dynamic thresholds — tighten during active attacks
        # soft multiplier is 5 (not 10) — attack intensity must not push
        # confused humans (score ~48–55) out of the SOFT zone.
        # e.g. max intensity=1.0 → dynamic_soft = 62-5 = 57, still covers 55 ✓
        dynamic_allow = self.base_allow - (attack_intensity * 10)
        dynamic_soft  = self.base_soft  - (attack_intensity * 5)   # fixed: was ×10
        dynamic_hard  = self.base_hard  - (attack_intensity * 5)

        if final_score < dynamic_allow:
            decision = "ALLOW"
        elif final_score < dynamic_soft:
            decision = "SOFT_CAPTCHA"
        elif final_score < dynamic_hard:
            decision = "HARD_CAPTCHA"
        else:
            decision = "BLOCK"

        return {
            "final_risk_score": round(final_score, 2),
            "raw_bot_prob":     round(bot_prob_raw, 4),
            "remapped_prob":    round(bot_prob, 4),
            "attack_intensity": round(attack_intensity, 3),
            "user_trust":       trust_score,
            "decision":         decision
        }