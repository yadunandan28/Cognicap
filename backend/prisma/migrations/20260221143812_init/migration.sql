/*
  Warnings:

  - You are about to drop the column `userId` on the `Session` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" DROP COLUMN "userId",
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "sessionDuration" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "mouseMoveCount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "backspaceCount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "focusChanges" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "mouseDirectionChanges" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "pasteUsageCount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "sessionRequestCount" SET DATA TYPE DOUBLE PRECISION;
