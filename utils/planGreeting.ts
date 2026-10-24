import type { ReadingPlan, ReadingPlanDay } from '../types';
import { getReadingPlanLateDays } from './readingPlanStatus';

export function planGreeting(plan: ReadingPlan, days: ReadingPlanDay[], now = new Date()): string {
  const late = getReadingPlanLateDays(plan, days, now);
  if (late > 0) return late <= 5 ? `late_${late}` : 'resume';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const readToday = days.some(day => day.isCompleted && day.completedDate && new Date(day.completedDate).toDateString() === today.toDateString());
  return readToday || plan.isCompleted ? 'completed' : 'today';
}
export function greetingDayKey(userId: number, now = new Date()): string {
  return `plan-greeting:${userId}:${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}
