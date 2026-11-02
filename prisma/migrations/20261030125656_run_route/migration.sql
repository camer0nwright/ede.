-- Recorded runs (SPEC decision 82): whether a run came from GPS, and its route.
ALTER TABLE "RunLog" ADD COLUMN "recorded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RunLog" ADD COLUMN "route" TEXT;
