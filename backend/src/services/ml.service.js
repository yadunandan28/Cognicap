const axios = require("axios");

exports.getMLDecision = async (features) => {
  const response = await axios.post(
    process.env.ML_SERVICE_URL + "/calculate-risk",
    features,
    { timeout: 3000 }
  );

  return response.data;
};
