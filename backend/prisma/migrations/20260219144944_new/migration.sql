/*
  Warnings:

  - You are about to drop the column `action` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `classification` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `Session` table. All the data in the column will be lost.
  - Added the required column `burstScore` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clickRandomnessScore` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `correctionDelayMean` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idleTimeRatio` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `keyFlightTimeVariance` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `keyHoldTimeMean` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mouseAccelerationMean` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mouseDirectionChanges` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pasteUsageCount` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestsPerMinute` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionRequestCount` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `typingVariance` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `honeypotTriggered` on the `Session` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "action",
DROP COLUMN "classification",
DROP COLUMN "score",
ADD COLUMN     "attackIntensity" DOUBLE PRECISION,
ADD COLUMN     "burstScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "clickRandomnessScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "correctionDelayMean" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "decision" TEXT,
ADD COLUMN     "finalRiskScore" DOUBLE PRECISION,
ADD COLUMN     "idleTimeRatio" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "keyFlightTimeVariance" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "keyHoldTimeMean" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "mouseAccelerationMean" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "mouseDirectionChanges" INTEGER NOT NULL,
ADD COLUMN     "pasteUsageCount" INTEGER NOT NULL,
ADD COLUMN     "requestsPerMinute" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "sessionRequestCount" INTEGER NOT NULL,
ADD COLUMN     "typingVariance" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "userTrust" INTEGER,
DROP COLUMN "honeypotTriggered",
ADD COLUMN     "honeypotTriggered" INTEGER NOT NULL;
