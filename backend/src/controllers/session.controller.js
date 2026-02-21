const prisma = require("../config/prisma");
const { getMLDecision } = require("../services/ml.service");

exports.analyzeSession = async (req, res) => {
  try {
    const features = req.body;

    // Save raw session first
    const session = await prisma.session.create({
      data: features
    });

    let mlResult;

    try {
      mlResult = await getMLDecision(features);
    } catch (err) {
      console.error("ML Service unavailable:", err.message);

      // Fallback policy
      mlResult = {
        final_risk_score: 50,
        attack_intensity: 0,
        user_trust: 0,
        decision: "SOFT_CAPTCHA",
        reason: "ml_unavailable"
      };
    }

    // Update session with ML results
    await prisma.session.update({
      where: { id: session.id },
      data: {
        finalRiskScore: mlResult.final_risk_score,
        attackIntensity: mlResult.attack_intensity,
        userTrust: mlResult.user_trust,
        decision: mlResult.decision
      }
    });

    return res.json(mlResult);

  } catch (error) {
    console.error("Session analysis failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
