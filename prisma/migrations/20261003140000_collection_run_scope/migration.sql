-- CreateEnum
CREATE TYPE "CollectionRunScope" AS ENUM ('FLEET', 'DIAGNOSTIC');

-- AlterTable
ALTER TABLE "CollectionRun" ADD COLUMN "scope" "CollectionRunScope" NOT NULL DEFAULT 'FLEET';

-- CreateIndex
CREATE INDEX "CollectionRun_scope_finishedAt_idx" ON "CollectionRun"("scope", "finishedAt" DESC);
