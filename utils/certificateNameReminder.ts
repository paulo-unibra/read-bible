import type { ReadingPlan, ReadingPlanDay } from "../types";

/** Uses reading progress, including lazy-loaded schedules, rather than calendar dates. */
export function getCertificateNameRemainingDays(
  plan: ReadingPlan | null,
  days: ReadingPlanDay[],
) {
  if (
    !plan ||
    !plan.isActive ||
    plan.isCompleted ||
    !Number.isInteger(plan.totalDays) ||
    plan.totalDays <= 0
  )
    return null;
  const ownDays = days.filter((day) => day.planId === plan.id);
  const chapters = new Set<string>();
  for (const day of ownDays) {
    for (const reading of day.readings || []) {
      for (
        let chapter = reading.startChapter;
        chapter <= reading.endChapter;
        chapter++
      ) {
        chapters.add(`${reading.bookName || reading.bookId}:${chapter}`);
      }
    }
  }
  // Some schedules finish the Bible before the calendar deadline. Only trust
  // the downloaded day count once it includes the whole plan's chapter coverage.
  if (
    plan.totalChapters &&
    plan.totalChapters > 0 &&
    chapters.size >= plan.totalChapters
  ) {
    const pending = new Set(
      ownDays.filter((day) => !day.isCompleted).map((day) => day.dayNumber),
    ).size;
    return pending >= 1 && pending <= 5 ? pending : null;
  }
  const knownCompletedDays = new Set(
    ownDays.filter((day) => day.isCompleted).map((day) => day.dayNumber),
  ).size;
  const completedDays = Math.max(
    Number.isFinite(plan.completedDays) ? plan.completedDays : 0,
    knownCompletedDays,
  );
  const remaining = plan.totalDays - completedDays;
  return remaining >= 1 && remaining <= 5 ? remaining : null;
}
