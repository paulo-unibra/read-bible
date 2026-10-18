/** Planos anuais começam hoje; com menos de 90 dias, terminam no próximo ano. */
export function getAnnualReadingPeriod(today = new Date()) {
  const startDate = new Date(today);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59);
  const calendarDaysBetween = (start: Date, end: Date) =>
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86400000 + 1;

  if (calendarDaysBetween(startDate, endDate) < 90) {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  return {
    startDate,
    endDate,
    totalDays: calendarDaysBetween(startDate, endDate),
    planYear: endDate.getFullYear(),
  };
}
