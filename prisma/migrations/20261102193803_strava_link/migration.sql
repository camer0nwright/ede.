-- Strava connections (SPEC decision 83): encrypted tokens for sending recorded runs.
CREATE TABLE "StravaLink" (
    "athleteId" TEXT NOT NULL PRIMARY KEY,
    "stravaAthleteId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StravaLink_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
