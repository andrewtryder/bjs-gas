-- CreateTable
CREATE TABLE "CollectionRun" (
    "id" BIGSERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "clubsConfigured" INTEGER NOT NULL,
    "clubsSucceeded" INTEGER NOT NULL,
    "clubsEmptyFuels" INTEGER NOT NULL,
    "clubsHardFailed" INTEGER NOT NULL,
    "fuelObservations" INTEGER NOT NULL,
    "historyChanges" INTEGER NOT NULL,
    "databaseQueries" INTEGER NOT NULL,
    "degraded" BOOLEAN NOT NULL,
    "failures" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionRun_finishedAt_idx" ON "CollectionRun"("finishedAt" DESC);
