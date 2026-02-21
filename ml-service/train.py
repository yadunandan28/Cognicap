"""
train.py — v9.2
================
Pairs with generate_dataset.py v9.2.

Key calibration change: classes 1 & 2 now have identical feature
distributions, so raw XGBoost will output ~0.50 for both. Isotonic
calibration then stretches those into the target band [0.30–0.70].

The 'sigmoid' method is added as an option comment — isotonic is
preferred for trees with large training sets.
"""

import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, confusion_matrix
from xgboost import XGBClassifier

DATA_PATH = "data/dataset_v9_calibrated.csv"

# ──────────────────────────────────────────────
# Load & feature-engineer
# ──────────────────────────────────────────────
df = pd.read_csv(DATA_PATH)

numeric_cols = df.select_dtypes(include=[np.number]).columns
df[numeric_cols] = df[numeric_cols].clip(lower=0)

epsilon = 1e-6
df["typingConsistency"]    = df["avgTypingSpeed"]    / (df["typingVariance"] + epsilon)
df["movementEfficiency"]   = df["mousePathLength"]   / (df["mouseMoveCount"] + epsilon)
df["interactionIntensity"] = df["mouseMoveCount"]    + df["sessionRequestCount"]
df["trafficPressure"]      = df["requestsPerMinute"] * df["burstScore"]

df.replace([np.inf, -np.inf], np.nan, inplace=True)
df.dropna(inplace=True)

source_class = df["source_class"].values

X = df.drop(["label", "honeypotTriggered", "source_class"], axis=1)
y = df["label"]

joblib.dump(list(X.columns), "feature_order.pkl")

# ──────────────────────────────────────────────
# Train / test split (keep source_class aligned)
# ──────────────────────────────────────────────
idx = np.arange(len(X))

X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
    X, y, idx, test_size=0.2, random_state=42, stratify=y
)

sc_test = source_class[idx_test]

scaler         = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

# ──────────────────────────────────────────────
# XGBoost — soft settings
# With identical overlap distributions, max_depth=3
# further prevents the model from memorising any
# residual accidental separation.
# ──────────────────────────────────────────────
base_model = XGBClassifier(
    n_estimators=350,
    max_depth=3,            # shallower than v9.1 — overlap needs softness
    learning_rate=0.05,
    subsample=0.75,
    colsample_bytree=0.65,
    reg_alpha=2.0,          # heavier regularisation
    reg_lambda=2.5,
    min_child_weight=8,
    gamma=1.5,
    eval_metric="logloss",
    random_state=42,
)

# Isotonic calibration over 5 folds
calibrated_model = CalibratedClassifierCV(
    estimator=base_model,
    method="isotonic",
    cv=5
)

calibrated_model.fit(X_train_scaled, y_train)

# ──────────────────────────────────────────────
# Standard evaluation
# Note: accuracy will be ~85–90% because the
# overlap classes are genuinely ambiguous by design.
# That is CORRECT behaviour, not a failure.
# ──────────────────────────────────────────────
y_pred = calibrated_model.predict(X_test_scaled)
y_prob = calibrated_model.predict_proba(X_test_scaled)

# class index 0 = bot, index 1 = human
# P(bot) = probability of class 0
bot_probs = y_prob[:, 0]

print("=" * 65)
print("CLASSIFICATION REPORT")
print("(accuracy ~85-90% expected — overlap classes are intentionally")
print("ambiguous, lower accuracy = better calibration)")
print("=" * 65)
print(classification_report(y_test, y_pred))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# ──────────────────────────────────────────────
# Per-class probability diagnostics
# ──────────────────────────────────────────────
print("\n" + "=" * 65)
print("PROBABILITY BAND DIAGNOSTICS  (P(bot) per source class)")
print("=" * 65)

class_names = ["Clear Human",   "Confused Human", "Stealth Bot",  "Clear Bot"]
targets     = [(0.05, 0.20),    (0.30, 0.55),     (0.45, 0.70),  (0.75, 0.95)]

all_pass = True
for sc_id, (name, (lo, hi)) in enumerate(zip(class_names, targets)):
    mask  = (sc_test == sc_id)
    probs = bot_probs[mask]
    if len(probs) == 0:
        print(f"  {name:<18} — no test samples")
        continue
    p5, p25, p50, p75, p95 = np.percentile(probs, [5, 25, 50, 75, 95])
    in_band = np.mean((probs >= lo) & (probs <= hi)) * 100
    ok      = in_band > 55
    status  = "PASS" if ok else "FAIL"
    if not ok:
        all_pass = False
    print(f"  {name:<18}  p5={p5:.2f}  p25={p25:.2f}  median={p50:.2f}"
          f"  p75={p75:.2f}  p95={p95:.2f}  in-band={in_band:.1f}%"
          f"  target=[{lo},{hi}]  [{status}]")

print()
if all_pass:
    print("  ALL BANDS PASS")
else:
    print("  FAILED BANDS — tuning guide:")
    print()
    print("  Clear Human in-band too low AND median < 0.05:")
    print("    → Raise avgTypingSpeed upper bound in generate_clear_human()")
    print("    → Lower clickRandomnessScore lower bound closer to 0.50")
    print()
    print("  Confused Human / Stealth Bot not near 0.50:")
    print("    → They MUST share identical ranges in _overlap_base()")
    print("    → Increase label noise to 18% for overlap classes")
    print("    → Reduce max_depth to 2 in train.py")
    print()
    print("  Clear Bot in-band too low AND median > 0.95:")
    print("    → Lower avgTypingSpeed lower bound toward 15.0")
    print("    → Raise clickRandomnessScore upper bound toward 0.35")

# ──────────────────────────────────────────────
# Feature importance
# ──────────────────────────────────────────────
print("\n" + "=" * 65)
print("FEATURE IMPORTANCE")
print("=" * 65)
try:
    base = calibrated_model.calibrated_classifiers_[0].estimator
    fi   = pd.DataFrame({
        "feature":    X.columns,
        "importance": base.feature_importances_
    }).sort_values("importance", ascending=False)
    print(fi.to_string(index=False))
    top = fi.iloc[0]
    if top["importance"] > 0.20:
        print(f"\n  WARNING: '{top['feature']}' dominates at {top['importance']:.1%}.")
        print(f"  Add this feature to the identical range in _overlap_base().")
    else:
        print(f"\n  OK: balanced importances (top = {top['importance']:.1%})")
except Exception as e:
    print(f"  Could not extract importances: {e}")

# ──────────────────────────────────────────────
# Save artefacts
# ──────────────────────────────────────────────
joblib.dump(calibrated_model, "model.pkl")
joblib.dump(scaler,           "scaler.pkl")
joblib.dump(list(X.columns),  "feature_order.pkl")

print("\nSaved: model.pkl  scaler.pkl  feature_order.pkl")