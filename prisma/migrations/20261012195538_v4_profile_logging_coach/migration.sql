-- CreateTable
CREATE TABLE "Injury" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "athleteId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "painLevel" INTEGER NOT NULL,
    "painWhen" TEXT NOT NULL,
    "notes" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Injury_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanOutline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "athleteId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "input" TEXT NOT NULL,
    "outline" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanOutline_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "muscleGroup" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isLowerBody" BOOLEAN NOT NULL,
    "isMainLift" BOOLEAN NOT NULL DEFAULT false,
    "failureAllowed" BOOLEAN NOT NULL,
    "defaultRestSeconds" INTEGER NOT NULL,
    "weightStepKg" REAL NOT NULL,
    "loads" TEXT NOT NULL,
    "alternatives" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "setType" TEXT NOT NULL DEFAULT 'working',
    "plannedReps" TEXT,
    "plannedRpe" REAL,
    "weightKg" REAL,
    "reps" INTEGER,
    "rpe" REAL,
    "completedAt" DATETIME,
    CONSTRAINT "SetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "distanceKm" REAL,
    "durationSeconds" INTEGER,
    "avgHeartRate" INTEGER,
    "notes" TEXT,
    CONSTRAINT "RunLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "athleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "suggestedChange" TEXT,
    "changeStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachMessage_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Athlete" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "goalType" TEXT NOT NULL,
    "goalDetail" TEXT,
    "targetDate" DATETIME,
    "raceDistance" TEXT,
    "ultraDistanceKm" REAL,
    "elevationGainM" INTEGER,
    "terrain" TEXT,
    "experienceLevel" TEXT NOT NULL DEFAULT 'intermediate',
    "strengthVolume" TEXT NOT NULL DEFAULT 'low',
    "currentTraining" TEXT,
    "lastWeekRunMinutes" INTEGER,
    "recent5kMinutes" REAL,
    "equipment" TEXT,
    "injuryHistory" TEXT,
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "distanceUnit" TEXT NOT NULL DEFAULT 'km',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Athlete" ("createdAt", "currentTraining", "equipment", "goalDetail", "goalType", "id", "injuryHistory", "name", "targetDate", "updatedAt") SELECT "createdAt", "currentTraining", "equipment", "goalDetail", "goalType", "id", "injuryHistory", "name", "targetDate", "updatedAt" FROM "Athlete";
DROP TABLE "Athlete";
ALTER TABLE "new_Athlete" RENAME TO "Athlete";
CREATE TABLE "new_PlanWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "athleteId" TEXT NOT NULL,
    "outlineId" TEXT,
    "weekStart" DATETIME NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'base',
    "runMinutes" INTEGER NOT NULL DEFAULT 0,
    "strengthMinutes" INTEGER NOT NULL DEFAULT 0,
    "quality" TEXT,
    "dayNotes" TEXT,
    "coachNote" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanWeek_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanWeek_outlineId_fkey" FOREIGN KEY ("outlineId") REFERENCES "PlanOutline" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PlanWeek" ("athleteId", "createdAt", "id", "summary", "weekNumber", "weekStart") SELECT "athleteId", "createdAt", "id", "summary", "weekNumber", "weekStart" FROM "PlanWeek";
DROP TABLE "PlanWeek";
ALTER TABLE "new_PlanWeek" RENAME TO "PlanWeek";
CREATE UNIQUE INDEX "PlanWeek_athleteId_weekStart_key" ON "PlanWeek"("athleteId", "weekStart");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "isKeySession" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT,
    "level" INTEGER,
    "steps" TEXT,
    "bodyFocus" TEXT,
    "exercises" TEXT,
    "plannedMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "actualMinutes" INTEGER,
    "effort" INTEGER,
    "notes" TEXT,
    "skipReason" TEXT,
    CONSTRAINT "Session_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "PlanWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("actualMinutes", "date", "effort", "id", "intensity", "notes", "plannedMinutes", "skipReason", "slot", "status", "steps", "title", "type", "weekId") SELECT "actualMinutes", "date", "effort", "id", "intensity", "notes", "plannedMinutes", "skipReason", "slot", "status", "steps", "title", "type", "weekId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_weekId_date_slot_key" ON "Session"("weekId", "date", "slot");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Injury_athleteId_resolvedAt_idx" ON "Injury"("athleteId", "resolvedAt");

-- CreateIndex
CREATE INDEX "PlanOutline_athleteId_active_idx" ON "PlanOutline"("athleteId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_sessionId_exerciseId_setNumber_key" ON "SetLog"("sessionId", "exerciseId", "setNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RunLog_sessionId_key" ON "RunLog"("sessionId");

-- CreateIndex
CREATE INDEX "CoachMessage_athleteId_createdAt_idx" ON "CoachMessage"("athleteId", "createdAt");

