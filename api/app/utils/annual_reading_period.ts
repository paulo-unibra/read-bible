import { DateTime } from 'luxon'

/** Conta dias de calendário, incluindo hoje, sem depender do horário da criação. */
export function getAnnualReadingPeriod(today = DateTime.now()) {
  const startDate = today.startOf('day')
  let endDate = startDate.endOf('year')

  if (Math.round(endDate.startOf('day').diff(startDate, 'days').days) + 1 < 90) {
    endDate = startDate.plus({ years: 1 }).endOf('year')
  }

  return {
    startDate,
    endDate,
    totalDays: Math.round(endDate.startOf('day').diff(startDate, 'days').days) + 1,
    planYear: endDate.year,
  }
}
