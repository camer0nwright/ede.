-- Sending recorded runs to Strava (SPEC decision 84): pauses for the GPX file, and where the upload is.
ALTER TABLE "RunLog" ADD COLUMN "pauses" TEXT;
ALTER TABLE "RunLog" ADD COLUMN "stravaActivityId" TEXT;
ALTER TABLE "RunLog" ADD COLUMN "stravaStatus" TEXT;
ALTER TABLE "RunLog" ADD COLUMN "stravaUploadId" TEXT;
