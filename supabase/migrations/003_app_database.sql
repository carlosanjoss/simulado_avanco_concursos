-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulado" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "totalQuestoes" INTEGER NOT NULL DEFAULT 30,
    "temasFoco" TEXT,
    "pdfNome" TEXT NOT NULL,
    "pdfHash" TEXT NOT NULL,
    "questoesJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NAO_INICIADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Simulado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tentativa" (
    "id" TEXT NOT NULL,
    "activeKey" TEXT,
    "simuladoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "respostas" TEXT NOT NULL,
    "pontuacao" INTEGER NOT NULL,
    "totalQuestoes" INTEGER NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "selectedAnswers" TEXT,
    "concluidoEm" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tentativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "provider" TEXT,
    "durationMs" INTEGER,
    "tokensEstimated" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionFeedback" (
    "id" TEXT NOT NULL,
    "simuladoId" TEXT NOT NULL,
    "questaoId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "MonthlyUsage_userId_monthKey_idx" ON "MonthlyUsage"("userId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyUsage_userId_monthKey_key" ON "MonthlyUsage"("userId", "monthKey");

-- CreateIndex
CREATE INDEX "Simulado_userId_pdfHash_idx" ON "Simulado"("userId", "pdfHash");

-- CreateIndex
CREATE INDEX "Simulado_userId_idx" ON "Simulado"("userId");

-- CreateIndex
CREATE INDEX "Simulado_createdAt_idx" ON "Simulado"("createdAt");

-- CreateIndex
CREATE INDEX "Simulado_pdfHash_idx" ON "Simulado"("pdfHash");

-- CreateIndex
CREATE UNIQUE INDEX "Tentativa_activeKey_key" ON "Tentativa"("activeKey");

-- CreateIndex
CREATE INDEX "Tentativa_simuladoId_idx" ON "Tentativa"("simuladoId");

-- CreateIndex
CREATE INDEX "Tentativa_userId_idx" ON "Tentativa"("userId");

-- CreateIndex
CREATE INDEX "Tentativa_concluidoEm_idx" ON "Tentativa"("concluidoEm");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "QuestionFeedback_simuladoId_questaoId_idx" ON "QuestionFeedback"("simuladoId", "questaoId");

-- AddForeignKey
ALTER TABLE "MonthlyUsage" ADD CONSTRAINT "MonthlyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulado" ADD CONSTRAINT "Simulado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tentativa" ADD CONSTRAINT "Tentativa_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tentativa" ADD CONSTRAINT "Tentativa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFeedback" ADD CONSTRAINT "QuestionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFeedback" ADD CONSTRAINT "QuestionFeedback_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
