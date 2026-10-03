import type { ClubFailure } from "../fuel/types.js";

export function isEmptyFuelFailure(error: string): boolean {
  return /empty fuel/i.test(error);
}

export function isCollectionAbortedFailure(failures: ClubFailure[] | undefined): boolean {
  return (failures ?? []).some((f) => /collection_aborted/i.test(f.error));
}

export function isUsableCollectionRun(run: {
  fuelObservations: number;
  failures?: ClubFailure[];
}): boolean {
  if (run.fuelObservations <= 0) return false;
  if (isCollectionAbortedFailure(run.failures)) return false;
  return true;
}
