export type AnalyticsRange = '7d' | '30d' | '90d' | 'all'

export type AnalyticsPeriod = {
  range: AnalyticsRange
  from: Date | null
  toExclusive: Date
  generatedAt: Date
}

export function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

export function addUtcDays(date: Date, days: number): Date {
  const next = utcDayStart(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function utcDateKey(date: Date): string {
  return utcDayStart(date).toISOString().slice(0, 10)
}

export function eachUtcDateKey(from: Date, toExclusive: Date): string[] {
  const keys: string[] = []
  let cursor = utcDayStart(from)
  const end = toExclusive.getTime()

  while (cursor.getTime() < end) {
    keys.push(utcDateKey(cursor))
    cursor = addUtcDays(cursor, 1)
  }

  return keys
}

export function resolveAnalyticsPeriod(
  range: AnalyticsRange,
  now: Date,
  earliestRecord: Date | null,
): AnalyticsPeriod {
  const generatedAt = now
  const todayStart = utcDayStart(now)
  const toExclusive = addUtcDays(todayStart, 1)

  if (range === 'all') {
    return {
      range,
      from: earliestRecord ? utcDayStart(earliestRecord) : null,
      toExclusive,
      generatedAt,
    }
  }

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90

  return {
    range,
    from: addUtcDays(todayStart, -(days - 1)),
    toExclusive,
    generatedAt,
  }
}
