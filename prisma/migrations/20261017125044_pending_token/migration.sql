-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN "pendingTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_pendingTokenHash_key" ON "Athlete"("pendingTokenHash");

