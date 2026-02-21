-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionDuration" INTEGER NOT NULL,
    "avgTypingSpeed" DOUBLE PRECISION NOT NULL,
    "mouseMoveCount" INTEGER NOT NULL,
    "clickIntervalAvg" DOUBLE PRECISION NOT NULL,
    "mousePathLength" DOUBLE PRECISION NOT NULL,
    "backspaceCount" INTEGER NOT NULL,
    "focusChanges" INTEGER NOT NULL,
    "honeypotTriggered" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION,
    "classification" TEXT,
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
