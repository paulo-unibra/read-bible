export function isPlanScheduleComplete(
  totalDays: number,
  readings: { day: number; isCompleted: boolean | number }[]
) {
  if (!Number.isInteger(totalDays) || totalDays <= 0) return false
  const completedDays = new Set<number>()
  for (const reading of readings) {
    if (!reading.isCompleted) return false
    completedDays.add(reading.day)
  }
  for (let day = 1; day <= totalDays; day++) {
    if (!completedDays.has(day)) return false
  }
  return true
}
