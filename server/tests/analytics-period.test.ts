import { describe, expect, it } from 'vitest'
import {
  addUtcDays,
  eachUtcDateKey,
  resolveAnalyticsPeriod,
  utcDayStart,
} from '../src/lib/analytics-period.js'

describe('analytics period', () => {
  const now = new Date('2026-08-31T15:30:00.000Z')

  it('includes today and the previous 6 UTC days for 7d', () => {
    const period = resolveAnalyticsPeriod('7d', now, null)
    expect(period.from?.toISOString()).toBe('2026-08-25T00:00:00.000Z')
    expect(period.toExclusive.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(eachUtcDateKey(period.from!, period.toExclusive)).toEqual([
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
    ])
  })

  it('includes today and the previous 29 UTC days for 30d', () => {
    const period = resolveAnalyticsPeriod('30d', now, null)
    expect(period.from?.toISOString()).toBe('2026-08-02T00:00:00.000Z')
    expect(eachUtcDateKey(period.from!, period.toExclusive)).toHaveLength(30)
  })

  it('returns a null from for all-time when there is no data', () => {
    const period = resolveAnalyticsPeriod('all', now, null)
    expect(period.from).toBeNull()
    expect(period.toExclusive.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })

  it('starts all-time at the UTC day of the earliest record', () => {
    const period = resolveAnalyticsPeriod(
      'all',
      now,
      new Date('2026-08-20T18:00:00.000Z'),
    )
    expect(period.from?.toISOString()).toBe('2026-08-20T00:00:00.000Z')
  })

  it('advances UTC days without using the local timezone', () => {
    const start = utcDayStart(now)
    expect(addUtcDays(start, 1).toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})
