export type CollectionFailure = {
  clubNumber: number;
  status?: number | undefined;
  error: string;
  attempts: number;
};

export type CollectionLockStatus = {
  inProgress: boolean;
  startedAt: string | null;
  ageMs: number | null;
  ageSeconds: number | null;
  overExpectedDuration: boolean;
  stale: boolean;
};

export type StatusFreshness = {
  latestObservedAt: string | null;
  oldestObservedAt: string | null;
  currentPriceRows: number;
  stationsObservedRecently: number;
  freshStationRatio: number;
  freshWindowMinutes: number;
};

export type StatusLastCollection = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  clubsConfigured: number;
  clubsSucceeded: number;
  clubsEmptyFuels: number;
  clubsHardFailed: number;
  clubsFailed: number;
  fuelObservations: number;
  historyChanges: number;
  databaseQueries: number;
  degraded: boolean;
  failures: CollectionFailure[];
  usable: boolean;
};

export type SystemStatusResponse = {
  ok: true;
  healthy: boolean;
  unhealthyReasons: string[];
  lastAttemptedCollection: StatusLastCollection | null;
  lastSuccessfulCollection: StatusLastCollection | null;
  lastCollection: StatusLastCollection | null;
  collectionLock: CollectionLockStatus;
  freshness: StatusFreshness;
  configuredGasClubs: number;
};
