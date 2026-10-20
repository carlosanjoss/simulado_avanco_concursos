CREATE TABLE IF NOT EXISTS "QuestionBankEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "simuladoId" TEXT NOT NULL,
  "questionId" INTEGER NOT NULL,
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "excludedAt" TIMESTAMP(3),
  "editorialStatus" TEXT NOT NULL DEFAULT 'PRIVATE',
  "sourceType" TEXT NOT NULL DEFAULT 'USER_GENERATED',
  "sourceName" TEXT,
  "licenseReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionBankEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionBankEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuestionBankEntry_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionBankEntry_userId_simuladoId_questionId_key" ON "QuestionBankEntry"("userId", "simuladoId", "questionId");
CREATE INDEX IF NOT EXISTS "QuestionBankEntry_userId_favorite_idx" ON "QuestionBankEntry"("userId", "favorite");
CREATE INDEX IF NOT EXISTS "QuestionBankEntry_editorialStatus_updatedAt_idx" ON "QuestionBankEntry"("editorialStatus", "updatedAt");
CREATE INDEX IF NOT EXISTS "QuestionBankEntry_simuladoId_idx" ON "QuestionBankEntry"("simuladoId");

CREATE TABLE IF NOT EXISTS "QuestionVersion" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "changeType" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "QuestionBankEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuestionVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionVersion_entryId_version_key" ON "QuestionVersion"("entryId", "version");
CREATE INDEX IF NOT EXISTS "QuestionVersion_entryId_createdAt_idx" ON "QuestionVersion"("entryId", "createdAt");
