ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "User_clerkId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "clerkId";
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "PendingInvite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "name" TEXT,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingInvite_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PendingInvite" DROP COLUMN IF EXISTS "password";
CREATE UNIQUE INDEX IF NOT EXISTS "PendingInvite_email_key" ON "PendingInvite"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "PendingInvite_token_key" ON "PendingInvite"("token");
CREATE INDEX IF NOT EXISTS "PendingInvite_email_idx" ON "PendingInvite"("email");
CREATE INDEX IF NOT EXISTS "PendingInvite_token_idx" ON "PendingInvite"("token");
-- Tokens antigos eram armazenados em texto puro. Eles são invalidados para que
-- somente novos convites, persistidos como SHA-256, possam ser utilizados.
UPDATE "PendingInvite" SET "used" = true WHERE "used" = false;

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_idx" ON "AdminAuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetUserId_idx" ON "AdminAuditLog"("targetUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
