import type { ReadingPlan, ReadingPlanDay } from "../types";

export function isReadingPlanLate(
  plan: ReadingPlan,
  days: ReadingPlanDay[],
  now = new Date(),
): boolean {
  if (plan.isCompleted) return false;

  // Compare calendar dates, preserving the plan's date without UTC shifts.
  const [year, month, day] = plan.startDate.split("T")[0].split("-").map(Number);
  const start = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isFinite(start)) return false;

  // Today's reading remains on time until the next calendar day.
  const dueDays = Math.min(plan.totalDays, Math.max(0, (today - start) / 86400000));
  return plan.completedDays < dueDays || days.some(
    (reading) => reading.dayNumber <= dueDays && !reading.isCompleted,
  );
}
