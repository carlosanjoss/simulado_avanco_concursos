ALTER TABLE "Simulado" ADD COLUMN IF NOT EXISTS "sourceDocumentId" TEXT;
CREATE INDEX IF NOT EXISTS "Simulado_sourceDocumentId_idx" ON "Simulado"("sourceDocumentId");
