import type { ReadingPlanDay } from '../types';

// Progress follows unfinished readings, even after the scheduled end date.
export function getNextPlanReading(days: ReadingPlanDay[]): ReadingPlanDay | null {
  return days.reduce<ReadingPlanDay | null>((oldest, day) => {
    if (day.isCompleted) return oldest;
    return !oldest || day.dayNumber < oldest.dayNumber ? day : oldest;
  }, null);
}
