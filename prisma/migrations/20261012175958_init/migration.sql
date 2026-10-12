-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "goalType" TEXT NOT NULL,
    "goalDetail" TEXT,
    "targetDate" DATETIME,
    "currentTraining" TEXT,
    "equipment" TEXT,
    "injuryHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AvailabilityDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "athleteId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "minutes" INTEGER,
    "isDouble" BOOLEAN NOT NULL DEFAULT false,
    "secondMinutes" INTEGER,
    CONSTRAINT "AvailabilityDay_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "athleteId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "isRecoveryWeek" BOOLEAN NOT NULL DEFAULT false,
    "isTaperWeek" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanWeek_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "isKeyRun" BOOLEAN NOT NULL DEFAULT false,
    "isHeavyLegs" BOOLEAN NOT NULL DEFAULT false,
    "steps" TEXT,
    "plannedMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "actualMinutes" INTEGER,
    "effort" INTEGER,
    "notes" TEXT,
    "skipReason" TEXT,
    CONSTRAINT "Session_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "PlanWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityDay_athleteId_dayOfWeek_key" ON "AvailabilityDay"("athleteId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "PlanWeek_athleteId_weekStart_key" ON "PlanWeek"("athleteId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Session_weekId_date_slot_key" ON "Session"("weekId", "date", "slot");
