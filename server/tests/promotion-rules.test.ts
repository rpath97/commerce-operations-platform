import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  assertPromotionSchedule,
  calculateDiscountAmount,
  derivePromotionStatus,
  normalizePromotionCode,
  toMoneyString,
} from '../src/lib/promotion.js'

describe('promotion code normalization', () => {
  it('trims and uppercases codes', () => {
    expect(normalizePromotionCode('save10')).toBe('SAVE10')
    expect(normalizePromotionCode('  summer-20  ')).toBe('SUMMER-20')
  })
})

describe('promotion derived status', () => {
  const startsAt = new Date('2026-06-01T00:00:00.000Z')
  const endsAt = new Date('2026-07-01T00:00:00.000Z')

  it('treats inactive promotions as DISABLED even when in window', () => {
    expect(
      derivePromotionStatus(
        { isActive: false, startsAt, endsAt },
        new Date('2026-06-15T00:00:00.000Z'),
      ),
    ).toBe('DISABLED')
  })

  it('is UPCOMING before startsAt', () => {
    expect(
      derivePromotionStatus(
        { isActive: true, startsAt, endsAt },
        new Date('2026-05-31T23:59:59.999Z'),
      ),
    ).toBe('UPCOMING')
  })

  it('is ACTIVE at exactly startsAt', () => {
    expect(
      derivePromotionStatus({ isActive: true, startsAt, endsAt }, startsAt),
    ).toBe('ACTIVE')
  })

  it('is EXPIRED at exactly endsAt', () => {
    expect(
      derivePromotionStatus({ isActive: true, startsAt, endsAt }, endsAt),
    ).toBe('EXPIRED')
  })
})

describe('promotion date validation', () => {
  it('rejects equal and reversed dates', () => {
    const start = new Date('2026-08-01T00:00:00.000Z')
    expect(() => assertPromotionSchedule(start, start)).toThrow(
      'End date must be after the start date.',
    )
    expect(() =>
      assertPromotionSchedule(start, new Date('2026-07-31T00:00:00.000Z')),
    ).toThrow('End date must be after the start date.')
  })
})

describe('discount calculation', () => {
  it('calculates a percentage discount', () => {
    const discount = calculateDiscountAmount(
      new Prisma.Decimal('200.00'),
      'PERCENTAGE',
      new Prisma.Decimal('15.00'),
    )
    expect(toMoneyString(discount)).toBe('30.00')
  })

  it('rounds percentage discounts to two decimals with half-up', () => {
    const discount = calculateDiscountAmount(
      new Prisma.Decimal('33.33'),
      'PERCENTAGE',
      new Prisma.Decimal('15.00'),
    )
    expect(toMoneyString(discount)).toBe('5.00')
  })

  it('calculates a fixed discount', () => {
    const discount = calculateDiscountAmount(
      new Prisma.Decimal('80.00'),
      'FIXED_AMOUNT',
      new Prisma.Decimal('20.00'),
    )
    expect(toMoneyString(discount)).toBe('20.00')
  })

  it('clamps a fixed discount to the subtotal', () => {
    const discount = calculateDiscountAmount(
      new Prisma.Decimal('20.00'),
      'FIXED_AMOUNT',
      new Prisma.Decimal('50.00'),
    )
    expect(toMoneyString(discount)).toBe('20.00')
  })
})
