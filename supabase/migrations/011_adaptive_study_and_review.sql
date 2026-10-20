ALTER TABLE "StudyPlanProgress" ADD COLUMN IF NOT EXISTS "scheduledDate" TIMESTAMP(3);
ALTER TABLE "StudyPlanProgress" ADD COLUMN IF NOT EXISTS "theme" TEXT;
ALTER TABLE "StudyPlanProgress" ADD COLUMN IF NOT EXISTS "mode" TEXT;
ALTER TABLE "StudyPlanProgress" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;

CREATE TABLE IF NOT EXISTS "StudyPlanSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "examName" TEXT,
  "examDate" TIMESTAMP(3),
  "availableDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  "minutesPerDay" INTEGER NOT NULL DEFAULT 45,
  "weeklyGoal" INTEGER NOT NULL DEFAULT 5,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyPlanSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyPlanSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudyPlanSettings_userId_key" ON "StudyPlanSettings"("userId");

ALTER TABLE "ReviewCard" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "ReviewCard" ADD COLUMN IF NOT EXISTS "favorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReviewCard" ADD COLUMN IF NOT EXISTS "errorType" TEXT NOT NULL DEFAULT 'CONTENT';
ALTER TABLE "ReviewCard" ADD COLUMN IF NOT EXISTS "manual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReviewCard" ADD COLUMN IF NOT EXISTS "lapses" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "ReviewCard_userId_favorite_idx" ON "ReviewCard"("userId", "favorite");
CREATE INDEX IF NOT EXISTS "ReviewCard_userId_errorType_idx" ON "ReviewCard"("userId", "errorType");
