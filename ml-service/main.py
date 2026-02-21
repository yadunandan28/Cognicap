from fastapi import FastAPI
from pydantic import BaseModel
from adaptive_risk_engine import AdaptiveRiskEngine

app = FastAPI(title="Adaptive Anti-Bot ML Service")

engine = AdaptiveRiskEngine()


# ----------------------------
# Request Schema
# ----------------------------
class SessionData(BaseModel):
    sessionDuration: float
    avgTypingSpeed: float
    typingVariance: float
    mouseMoveCount: float
    clickIntervalAvg: float
    mousePathLength: float
    backspaceCount: float
    focusChanges: float
    idleTimeRatio: float
    keyHoldTimeMean: float
    keyFlightTimeVariance: float
    correctionDelayMean: float
    pasteUsageCount: float
    mouseAccelerationMean: float
    mouseDirectionChanges: float
    clickRandomnessScore: float
    requestsPerMinute: float
    sessionRequestCount: float
    burstScore: float
    honeypotTriggered: int
    user_id: str


# ----------------------------
# Health Check
# ----------------------------
@app.get("/")
def root():
    return {"status": "ML service running"}


# ----------------------------
# Risk Endpoint
# ----------------------------
@app.post("/calculate-risk")
def calculate_risk(data: SessionData):
    session_dict = data.dict()

    user_id = session_dict.pop("user_id")

    result = engine.calculate_risk(session_dict, user_id)

    return result
