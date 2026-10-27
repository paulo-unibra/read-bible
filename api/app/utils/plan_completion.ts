export interface CompletionReading {
  bookName: string
  startChapter: number
  endChapter: number
  isCompleted: boolean | number
  completedAt: { toISO(): string | null } | null
}

/** Count each chapter once: legacy counters and overlapping readings can overcount. */
export function getPlanCompletion(totalChapters: number, readings: CompletionReading[]) {
  if (totalChapters <= 0 || readings.length === 0) return null
  const chapters = new Set<string>()
  let completedAt: string | null = null
  for (const reading of readings) {
    if (!reading.isCompleted || !reading.completedAt) return null
    if (
      !Number.isInteger(reading.startChapter) ||
      !Number.isInteger(reading.endChapter) ||
      reading.startChapter < 1 ||
      reading.endChapter < reading.startChapter ||
      reading.endChapter > 150
    )
      return null
    for (let chapter = reading.startChapter; chapter <= reading.endChapter; chapter++) {
      chapters.add(`${reading.bookName.trim().toLocaleLowerCase('pt-BR')}:${chapter}`)
    }
    const date = reading.completedAt.toISO()
    if (date && (!completedAt || Date.parse(date) > Date.parse(completedAt))) completedAt = date
  }
  return chapters.size >= totalChapters && completedAt
    ? { completedAt, chapters: totalChapters }
    : null
}
