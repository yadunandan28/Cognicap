const { z } = require("zod");

const sessionSchema = z.object({
  user_id: z.string(),
  sessionDuration: z.number(),
  avgTypingSpeed: z.number(),
  typingVariance: z.number(),
  mouseMoveCount: z.number(),
  clickIntervalAvg: z.number(),
  mousePathLength: z.number(),
  backspaceCount: z.number(),
  focusChanges: z.number(),
  idleTimeRatio: z.number(),
  keyHoldTimeMean: z.number(),
  keyFlightTimeVariance: z.number(),
  correctionDelayMean: z.number(),
  pasteUsageCount: z.number(),
  mouseAccelerationMean: z.number(),
  mouseDirectionChanges: z.number(),
  clickRandomnessScore: z.number(),
  requestsPerMinute: z.number(),
  sessionRequestCount: z.number(),
  burstScore: z.number(),
  honeypotTriggered: z.number()
});

exports.validateSession = (req, res, next) => {
  try {
    req.body = sessionSchema.parse(req.body);
    next();
  } catch (err) {
    return res.status(400).json({
      message: "Invalid session payload",
      details: err
    });

  }
};
