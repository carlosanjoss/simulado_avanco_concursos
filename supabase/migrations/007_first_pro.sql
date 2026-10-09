ALTER TABLE "Simulado" ADD COLUMN IF NOT EXISTS "difficultyTarget" TEXT NOT NULL DEFAULT 'MISTO';
ALTER TABLE "Simulado" ADD COLUMN IF NOT EXISTS "ocrUsed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "StudyPlanProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "taskKey" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyPlanProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyPlanProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudyPlanProgress_userId_weekKey_taskKey_key" ON "StudyPlanProgress"("userId", "weekKey", "taskKey");
CREATE INDEX IF NOT EXISTS "StudyPlanProgress_userId_weekKey_idx" ON "StudyPlanProgress"("userId", "weekKey");

CREATE TABLE IF NOT EXISTS "ReviewCard" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "simuladoId" TEXT NOT NULL,
  "questionId" INTEGER NOT NULL,
  "questionJson" TEXT NOT NULL,
  "lastAnswer" TEXT,
  "repetitions" INTEGER NOT NULL DEFAULT 0,
  "intervalDays" INTEGER NOT NULL DEFAULT 1,
  "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReviewedAt" TIMESTAMP(3),
  "masteredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewCard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewCard_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewCard_userId_simuladoId_questionId_key" ON "ReviewCard"("userId", "simuladoId", "questionId");
CREATE INDEX IF NOT EXISTS "ReviewCard_userId_dueAt_idx" ON "ReviewCard"("userId", "dueAt");
CREATE INDEX IF NOT EXISTS "ReviewCard_userId_masteredAt_idx" ON "ReviewCard"("userId", "masteredAt");
