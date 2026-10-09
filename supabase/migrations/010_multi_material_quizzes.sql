CREATE TABLE IF NOT EXISTS "SimuladoMaterial" (
  "id" TEXT NOT NULL,
  "simuladoId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimuladoMaterial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SimuladoMaterial_simuladoId_fkey" FOREIGN KEY ("simuladoId") REFERENCES "Simulado"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SimuladoMaterial_simuladoId_documentId_key" ON "SimuladoMaterial"("simuladoId", "documentId");
CREATE INDEX IF NOT EXISTS "SimuladoMaterial_documentId_idx" ON "SimuladoMaterial"("documentId");
CREATE INDEX IF NOT EXISTS "SimuladoMaterial_simuladoId_idx" ON "SimuladoMaterial"("simuladoId");

INSERT INTO "SimuladoMaterial" ("id", "simuladoId", "documentId", "fileName")
SELECT md5(random()::text || clock_timestamp()::text || s.id), s.id, s."sourceDocumentId", s."pdfNome"
FROM "Simulado" s
WHERE s."sourceDocumentId" IS NOT NULL
ON CONFLICT ("simuladoId", "documentId") DO NOTHING;
