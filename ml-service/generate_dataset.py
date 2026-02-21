"""
Dataset generator v9.5 — Continuous Gradient Edition (patched)
======================================================
Why v9.4 failed:
  Hard mixing (70% pure + 30% overlap) creates a BIMODAL distribution:
    Clear Human: 70% of samples → P(bot)≈0.03
                 30% of samples → P(bot)≈0.50
  With median determined by the dominant mode, median stays at 0.03.
  No blend ratio value can reliably place the median at 0.10–0.15.

THE FIX — single continuous gradient per class:
  Instead of switching between two distributions, each class uses ONE
  distribution whose tails naturally overlap with the adjacent class.
  This creates a unimodal probability distribution centred in the
  target band, not two separate peaks.

  Key: ALL features (including derived ones like typingConsistency)
  must have partial overlap with the adjacent class.

Distribution design (all features per class):

  Clear Human → target P(bot) 0.05–0.20
    avgTypingSpeed:        5–13    (overlap zone: 9–18, shared region 9–13)
    typingVariance:        1.5–5.0 (overlap zone: 0.7–2.8, shared 1.5–2.8)
    typingConsistency:     1.0–8.7 (overlap zone: 3.2–25.7, shared 3.2–8.7)
    keyFlightTimeVariance: 30–110  (overlap zone: 14–55, shared 30–55)
    mouseMoveCount:        110–460 (overlap zone: 55–190, shared 110–190)
    idleTimeRatio:         0.14–0.58 (overlap zone: 0.04–0.22, shared 0.14–0.22)

  Clear Bot → target P(bot) 0.75–0.95
    avgTypingSpeed:        15–40   (overlap zone: 9–18, shared 15–18)
    typingVariance:        0.3–1.5 (overlap zone: 0.7–2.8, shared 0.7–1.5)
    typingConsistency:     10–133  (overlap zone: 3.2–25.7, shared 10–25.7)
    keyFlightTimeVariance: 8–35    (overlap zone: 14–55, shared 14–35)
    mouseMoveCount:        12–130  (overlap zone: 55–190, shared 55–130)
    idleTimeRatio:         0.001–0.10 (overlap zone: 0.04–0.22, shared 0.04–0.10)

Overlap classes 1 & 2: UNCHANGED (98.5% / 97.4% in-band, do not touch).
"""

import random
import csv
import os

OUTPUT_PATH   = "data/dataset_v9_calibrated.csv"
TOTAL_SAMPLES = 24000
JITTER        = 0.06


def traffic(rpm):
    sc    = int(rpm * random.uniform(3, 7))
    burst = min(1.0, rpm / 40.0 + random.uniform(-0.05, 0.20))
    return sc, max(0.0, burst)


def jitter(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if k in ("label", "honeypotTriggered", "source_class"):
            out[k] = v
        elif isinstance(v, float):
            out[k] = max(0.0, v + random.gauss(0, abs(v) * JITTER + 1e-4))
        elif isinstance(v, int):
            delta = random.choice([-1, 0, 0, 1]) if random.random() < JITTER else 0
            out[k] = max(0, v + delta)
        else:
            out[k] = v
    return out


# ─────────────────────────────────────────────────────────────
# SHARED OVERLAP DISTRIBUTION  (UNCHANGED — both classes PASS)
# ─────────────────────────────────────────────────────────────
def _overlap_base():
    rpm = random.uniform(7.0, 20.0)
    sc, burst = traffic(rpm)
    return {
        "sessionDuration":       random.randint(3500, 13000),
        "avgTypingSpeed":        random.uniform(9.0,  18.0),
        "typingVariance":        random.uniform(0.7,   2.8),
        "mouseMoveCount":        random.randint(55,   190),
        "clickIntervalAvg":      random.uniform(150,  400),
        "mousePathLength":       random.uniform(1700, 5200),
        "backspaceCount":        random.randint(0,     5),
        "focusChanges":          random.randint(0,     2),
        "idleTimeRatio":         random.uniform(0.04, 0.22),
        "keyHoldTimeMean":       random.uniform(58,   135),
        "keyFlightTimeVariance": random.uniform(14,    55),
        "correctionDelayMean":   random.uniform(95,   350),
        "pasteUsageCount":       random.randint(0,     4),
        "mouseAccelerationMean": random.uniform(0.35,  1.8),
        "mouseDirectionChanges": random.randint(30,   125),
        "clickRandomnessScore":  random.uniform(0.20, 0.68),
        "requestsPerMinute":     rpm,
        "sessionRequestCount":   sc,
        "burstScore":            burst,
    }


# ══════════════════════════════════════════════
# CLASS 0 — CLEAR HUMAN  (label=1, source_class=0)
# Target P(bot) → 0.05–0.20
#
# Single continuous distribution. Upper tails of every
# feature reach into the overlap zone, so the model is
# gently uncertain — not bimodal.
#
# typingConsistency (top derived feature) range:
#   speed 5–13, variance 1.5–5.0 → ratio 1.0–8.7
#   overlap ratio: 3.2–25.7  → shared region: 3.2–8.7 (~20% of values)
# ══════════════════════════════════════════════
def generate_clear_human():
    rpm = random.uniform(0.5, 15.0)   # upper tail overlaps overlap zone (7–20)
    sc, burst = traffic(rpm)
    return {
        "sessionDuration":       random.randint(10000, 38000),
        "avgTypingSpeed":        random.uniform(5.0,  13.0),    # overlap at 9–13
        "typingVariance":        random.uniform(1.5,   5.0),    # overlap at 1.5–2.8
        "mouseMoveCount":        random.randint(110,  460),     # overlap at 110–190
        "clickIntervalAvg":      random.uniform(360,  950),
        "mousePathLength":       random.uniform(4000, 14000),
        "backspaceCount":        random.randint(4,     22),
        "focusChanges":          random.randint(1,      9),
        "idleTimeRatio":         random.uniform(0.14,  0.58),   # overlap at 0.14–0.22
        "keyHoldTimeMean":       random.uniform(105,  220),
        "keyFlightTimeVariance": random.uniform(30,   110),     # overlap at 30–55
        "correctionDelayMean":   random.uniform(300,  780),
        "pasteUsageCount":       random.randint(0,      2),
        "mouseAccelerationMean": random.uniform(1.2,   3.8),
        "mouseDirectionChanges": random.randint(90,   280),
        "clickRandomnessScore":  random.uniform(0.50,  0.99),   # overlap at 0.50–0.68
        "requestsPerMinute":     rpm,
        "sessionRequestCount":   sc,
        "burstScore":            burst,
        "honeypotTriggered":     0,
        "label":                 1,
        "source_class":          0,
    }


# ══════════════════════════════════════════════
# CLASS 1 — CONFUSED HUMAN  (label=1, source_class=1)
# UNCHANGED — 98.5% in-band
# ══════════════════════════════════════════════
def generate_confused_human():
    base = _overlap_base()
    base.update({
        "honeypotTriggered": 0,
        "label":             1,
        "source_class":      1,
    })
    return base


# ══════════════════════════════════════════════
# CLASS 2 — STEALTH BOT  (label=0, source_class=2)
# UNCHANGED — 97.4% in-band
# ══════════════════════════════════════════════
def generate_stealth_bot():
    base = _overlap_base()
    base.update({
        "honeypotTriggered": random.choices([0, 1], weights=[0.75, 0.25])[0],
        "label":             0,
        "source_class":      2,
    })
    return base


# ══════════════════════════════════════════════
# CLASS 3 — CLEAR BOT  (label=0, source_class=3)
# Target P(bot) → 0.75–0.95
#
# Single continuous distribution. Lower tails of every
# feature reach into the overlap zone.
#
# typingConsistency range:
#   speed 15–40, variance 0.3–1.5 → ratio 10–133
#   overlap ratio: 3.2–25.7  → shared region: 10–25.7 (~15% of values)
# ══════════════════════════════════════════════
def generate_clear_bot():
    rpm = random.uniform(10.0, 80.0)  # lower tail overlaps overlap zone (7–20)
    sc, burst = traffic(rpm)
    return {
        "sessionDuration":       random.randint(500,   6500),
        "avgTypingSpeed":        random.uniform(15.0,  40.0),   # overlap at 15–18
        "typingVariance":        random.uniform(0.3,    1.5),   # overlap at 0.7–1.5
        "mouseMoveCount":        random.randint(12,    130),    # overlap at 55–130
        "clickIntervalAvg":      random.uniform(45,    200),
        "mousePathLength":       random.uniform(250,   2700),
        "backspaceCount":        random.randint(0,       2),
        "focusChanges":          random.randint(0,       1),
        "idleTimeRatio":         random.uniform(0.001,  0.10),  # overlap at 0.04–0.10
        "keyHoldTimeMean":       random.uniform(20,     68),
        "keyFlightTimeVariance": random.uniform(8,      35),    # overlap at 14–35
        "correctionDelayMean":   random.uniform(20,    115),
        "pasteUsageCount":       random.randint(1,       6),
        "mouseAccelerationMean": random.uniform(0.03,   0.60),
        "mouseDirectionChanges": random.randint(6,      65),
        "clickRandomnessScore":  random.uniform(0.03,   0.32),  # overlap at 0.20–0.32
        "requestsPerMinute":     rpm,
        "sessionRequestCount":   sc,
        "burstScore":            burst,
        "honeypotTriggered":     random.choices([0, 1], weights=[0.5, 0.5])[0],
        "label":                 0,
        "source_class":          3,
    }


def apply_label_noise(rows):
    for i, row in enumerate(rows):
        threshold = 0.15 if row["source_class"] in (1, 2) else 0.04
        if random.random() < threshold:
            rows[i]["label"] = 1 - rows[i]["label"]
    return rows


def main():
    os.makedirs("data", exist_ok=True)
    rows = []

    per_class  = TOTAL_SAMPLES // 4
    generators = [generate_clear_human, generate_confused_human,
                  generate_stealth_bot, generate_clear_bot]
    names      = ["Clear Human", "Confused Human", "Stealth Bot", "Clear Bot"]

    for gen, name in zip(generators, names):
        class_rows = [jitter(gen()) for _ in range(per_class)]
        rows.extend(class_rows)
        print(f"  Generated {per_class:,} x {name}")

    rows = apply_label_noise(rows)
    random.shuffle(rows)

    keys = list(rows[0].keys())
    with open(OUTPUT_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDataset v9.5 saved -> {OUTPUT_PATH}")
    print(f"Total samples : {len(rows):,}")
    print(f"Design        : single continuous gradient, no hard mixing, no bimodal")
    print(f"Overlap zones (derived feature typingConsistency = speed/variance):")
    print(f"  Clear Human  ratio 1.0–8.7  | Overlap 3.2–25.7  | shared 3.2–8.7")
    print(f"  Clear Bot    ratio 10–133   | Overlap 3.2–25.7  | shared 10–25.7")


if __name__ == "__main__":
    main()