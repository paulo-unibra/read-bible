import type { ReadingPlan, ReadingPlanDay } from "../types";

export function getReadingPlanLateDays(
  plan: ReadingPlan,
  days: ReadingPlanDay[],
  now = new Date(),
): number {
  if (plan.isCompleted) return 0;

  // Compare calendar dates, preserving the plan's date without UTC shifts.
  const [year, month, day] = plan.startDate.split("T")[0].split("-").map(Number);
  const start = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isFinite(start)) return 0;

  // Today's reading remains on time until the next calendar day.
  const dueDays = Math.min(plan.totalDays, Math.max(0, (today - start) / 86400000));
  const uniqueDays = new Map(days.map((reading) => [reading.dayNumber, reading]));
  const pendingDueDays = [...uniqueDays.values()].filter(
    (reading) => reading.dayNumber <= dueDays && !reading.isCompleted,
  ).length;
  // Readings completed ahead of schedule do not cancel older pending days.
  const completedAhead = [...uniqueDays.values()].filter(
    (reading) => reading.dayNumber > dueDays && reading.isCompleted,
  ).length;
  return Math.min(dueDays, Math.max(0, dueDays - plan.completedDays + completedAhead, pendingDueDays));
}

export function isReadingPlanLate(
  plan: ReadingPlan,
  days: ReadingPlanDay[],
  now = new Date(),
): boolean {
  return getReadingPlanLateDays(plan, days, now) > 0;
}
