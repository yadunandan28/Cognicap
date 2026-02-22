const axios = require("axios");

exports.getMLDecision = async (features) => {
  try {
    const url = process.env.ML_SERVICE_URL + "/calculate-risk";
    console.log("Calling ML service at:", url);   // ← add this to debug

    const response = await axios.post(url, features, { timeout: 10000 });
    console.log("ML response:", response.data);    // ← and this

    return response.data;

  } catch (error) {
    console.error("ML service error:", error.message);  // ← see exact error
    // fallback
    return { final_risk_score: 50, decision: "SOFT_CAPTCHA", attack_intensity: 0, user_trust: 0 };
  }
};