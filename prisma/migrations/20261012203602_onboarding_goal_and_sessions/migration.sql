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
    "targetTimeSeconds" INTEGER,
    "justFinish" BOOLEAN NOT NULL DEFAULT false,
    "runsPerWeek" INTEGER,
    "liftsPerWeek" INTEGER,
    "recent5kMinutes" REAL,
    "equipment" TEXT,
    "injuryHistory" TEXT,
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "distanceUnit" TEXT NOT NULL DEFAULT 'km',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Athlete" ("createdAt", "currentTraining", "distanceUnit", "elevationGainM", "equipment", "experienceLevel", "goalDetail", "goalType", "id", "injuryHistory", "lastWeekRunMinutes", "name", "raceDistance", "recent5kMinutes", "strengthVolume", "targetDate", "terrain", "ultraDistanceKm", "updatedAt", "weightUnit") SELECT "createdAt", "currentTraining", "distanceUnit", "elevationGainM", "equipment", "experienceLevel", "goalDetail", "goalType", "id", "injuryHistory", "lastWeekRunMinutes", "name", "raceDistance", "recent5kMinutes", "strengthVolume", "targetDate", "terrain", "ultraDistanceKm", "updatedAt", "weightUnit" FROM "Athlete";
DROP TABLE "Athlete";
ALTER TABLE "new_Athlete" RENAME TO "Athlete";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

