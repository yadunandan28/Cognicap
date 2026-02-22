CogniCap — Passive Behavioral CAPTCHA System

A full-stack intelligent CAPTCHA system that silently classifies users as humans or bots using behavioral biometrics — no annoying puzzles for real users.
https://cognicap-production-de93.up.railway.app/

The Core Idea

"A real human should never see a CAPTCHA. A clear bot should be blocked instantly. The hard problem is the grey zone in between."

User TypeBehaviorSystem Response Clear HumanNatural typing, organic mouse movementALLOW — invisible, zero friction Confused HumanSlow typer, VPN user, mobileSOFT CAPTCHA — emoji grid + phrase Stealth BotMimics humans but too consistentHARD CAPTCHA — drag-and-drop image puzzle Clear BotMechanical speed, no mouse varianceBLOCK — session rejected

Features

Passive tracking — no UI impact on legitimate users
XGBoost + Isotonic calibration — well-calibrated bot probability scores
Adaptive thresholds — tighten automatically during active bot attacks
User trust system — known good users get lower risk scores over time
Honeypot field — hidden form field instantly flags auto-fill bots
Drag-and-drop image puzzle — 62 real photographs, spatial reasoning required
Emoji grid challenge — visual object recognition + phrase confirmation
Real-time debug panel — shows risk score, trust score, all 19 captured features
Fully Dockerized — runs identically in development and production
Deployed on Railway — with Supabase PostgreSQL + Railway Redis


Architecture
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (React)                       │
│  useBehaviorTracker → collects 19 features silently      │
│  LoginForm → SoftCaptcha / HardCaptcha modals            │
└───────────────────────┬─────────────────────────────────┘
                        │ POST /api/session/analyze
┌───────────────────────▼─────────────────────────────────┐
│              NODE.JS BACKEND (Express)                   │
│  Zod validation → session.controller → ml.service       │
│  Logs to PostgreSQL (Supabase) via Prisma ORM            │
└───────────────┬─────────────────────────────────────────┘
                │ POST /calculate-risk
┌───────────────▼─────────────────────────────────────────┐
│           ML SERVICE (Python / FastAPI)                  │
│  XGBoost → Piecewise Remap → Heuristic Boost             │
│  Trust Adjustment (Redis) → Dynamic Thresholds           │
│  Returns: { score, decision, raw_bot_prob, ... }         │
└───────────┬───────────────────────┬─────────────────────┘
            │                       │
    ┌───────▼──────┐      ┌─────────▼──────────┐
    │  PostgreSQL  │      │       Redis         │
    │  (Supabase)  │      │  attack_intensity   │
    │ Session logs │      │  user_trust scores  │
    └──────────────┘      └────────────────────┘

ML Pipeline
19 Behavioral Features Collected
CategoryFeaturesTypingavgTypingSpeed, typingVariance, keyHoldTimeMean, keyFlightTimeVariance, correctionDelayMean, backspaceCount, pasteUsageCountMousemouseMoveCount, mousePathLength, mouseAccelerationMean, mouseDirectionChanges, clickIntervalAvg, clickRandomnessScoreSessionsessionDuration, idleTimeRatio, focusChanges, requestsPerMinute, sessionRequestCount, burstScoreSecurityhoneypotTriggered
Score Pipeline
Raw XGBoost P(bot)
    ↓ Piecewise Linear Remapper (targets 4 score bands)
    ↓ × 100 → base ML score
    ↓ + Heuristic Boost (0–20) for stealth bot patterns
    ↓ − trust_score × 0.5 (Redis user history)
    ↓ Dynamic threshold comparison
    ↓ ALLOW / SOFT_CAPTCHA / HARD_CAPTCHA / BLOCK
Adaptive Thresholds
During a bot attack, attack_intensity rises in Redis, automatically tightening all thresholds — more sessions get challenged without any manual intervention. Decays automatically when traffic normalises.

 CAPTCHA Challenges
SoftCaptcha (Confused Humans)

3×3 emoji grid — select all matching symbols 
Phase 2: type the phrase "I am human" exactly
3 attempts before lockout

HardCaptcha (Stealth Bots)

62 real photographs split into 2×2 tiles and shuffled
Drag tiles back to correct positions
Requires spatial visual reasoning — not automatable
5 attempts before session is flagged
Full touch/mobile support


Database Design
PostgreSQL (Supabase) — Session Logs
Every authentication attempt is logged with all 19 raw features plus the ML result, enabling forensic analysis, model performance review, and attack investigation.
Redis — Live State
KeyTypePurposeattack_intensityfloatGlobal rolling bot pressure metricuser_trust:{id}int (−50 to +50)Per-user reputation score

Live Demo
https://cognicap-production-de93.up.railway.app
Try these scenarios:

Type naturally and click Authenticate → should get ALLOW
Type very fast without pausing → may trigger SOFT_CAPTCHA
Submit multiple times rapidly → attack_intensity rises, thresholds tighten


Local Setup
Prerequisites

Docker Desktop installed and running
Git

1. Clone the repo
bashgit clone https://github.com/YOUR_USERNAME/cognicap.git
cd cognicap
2. Create .env in root
envDATABASE_URL="your_supabase_postgresql_url"
VITE_API_URL=http://localhost:5000
3. Train the ML model
bashcd ml-service
pip install -r requirements.txt
python generate_dataset.py
python train.py
cd ..
4. Start all services
bashdocker compose up
Open http://localhost — the app is live.
Manual startup (without Docker)
bash# Terminal 1 — Redis
docker run -d -p 6379:6379 redis:7-alpine

# Terminal 2 — ML Service
cd ml-service
python -m uvicorn main:app --port 8001 --reload

# Terminal 3 — Backend
cd backend
npm install
npm run dev

# Terminal 4 — Frontend
cd "frontend/captcha system"
npm install
npm run dev

📁 Project Structure
cognicap/
├── frontend/
│   └── captcha system/          React + Vite + Tailwind
│       ├── public/images/        62 puzzle images (puzz_1.jpg…62.jpg)
│       └── src/
│           ├── components/
│           │   ├── LoginForm.jsx
│           │   ├── SoftCaptcha.jsx   Emoji grid + phrase
│           │   └── HardCaptcha.jsx   Drag-and-drop puzzle
│           └── hooks/
│               └── useBehaviorTracker.js
├── backend/                     Node.js + Express + Prisma
│   ├── src/
│   │   ├── controllers/session.controller.js
│   │   ├── services/ml.service.js
│   │   └── routes/session.routes.js
│   └── prisma/schema.prisma
├── ml-service/                  Python + FastAPI + XGBoost
│   ├── main.py
│   ├── adaptive_risk_engine.py
│   ├── generate_dataset.py
│   ├── train.py
│   ├── remapper.py
│   └── redis_state.py
└── docker-compose.yml

Deployment (Railway)
The app is deployed on Railway as 4 separate services:
ServiceTechnologyPortfrontendReact → nginx80backendNode.js Express5000ml-servicePython FastAPI8000RedisRailway Redis plugin6379
Database: Supabase PostgreSQL (external)
Each service has its own Dockerfile and is deployed independently from the same GitHub monorepo using Railway's root directory setting.

Tech Stack
LayerTechnologyFrontendReact 18, Vite, Tailwind CSS, AxiosBackendNode.js, Express, Prisma ORM, ZodML ServicePython, FastAPI, XGBoost, scikit-learn, pandasDatabasePostgreSQL (Supabase)Cache/StateRedisContainerDocker, Docker ComposeHostingRailwayWeb Servernginx (alpine)

Model Performance
Trained on 24,000 synthetic samples (6,000 per class) with intentional overlap between Confused Human and Stealth Bot classes — forcing the ML model to be genuinely uncertain (~P=0.50) for both. Separation is handled by the heuristic boost layer at runtime rather than during training, making the system harder to reverse-engineer.

Security Design Decisions

Honeypot field — absolutely positioned off-screen, triggers instant block if auto-filled
Heuristic boosts are runtime-only — not exposed via API, can't be reverse-engineered from model
Dynamic thresholds — auto-tighten during attacks without human intervention
Trust system — penalises repeated bot-like sessions, rewards consistent human behavior
Passive collection — no user consent friction, all signals are behavioral metadata only
