import { Prisma, type Promotion } from '@prisma/client'
import { writeAuditLog } from '../lib/audit.js'
import { prisma } from '../lib/prisma.js'
import {
  assertDiscountConfiguration,
  assertMinimumOrderValue,
  assertPromotionSchedule,
  assertPromotionUsable,
  calculateDiscountAmount,
  toMoneyDecimal,
  toMoneyString,
} from '../lib/promotion.js'
import { AppError } from '../middleware/errorHandler.js'
import { throwIfUniqueConflict } from '../utils/prisma-errors.js'
import type {
  AdminPromotionQuery,
  CreatePromotionInput,
  UpdatePromotionInput,
} from '../validators/promotion.validator.js'
import {
  toAdminPromotionDto,
  type AdminPromotionDto,
  type PromotionPreviewDto,
} from './promotion.mapper.js'

const ZERO = new Prisma.Decimal(0)

function promotionOrderBy(
  sort: AdminPromotionQuery['sort'],
): Prisma.PromotionOrderByWithRelationInput {
  if (sort === 'code-asc') {
    return { code: 'asc' }
  }
  if (sort === 'code-desc') {
    return { code: 'desc' }
  }
  if (sort === 'starts-soonest') {
    return { startsAt: 'asc' }
  }
  if (sort === 'ends-soonest') {
    return { endsAt: 'asc' }
  }
  return { createdAt: 'desc' }
}

function statusWhere(
  status: AdminPromotionQuery['status'],
  now: Date,
): Prisma.PromotionWhereInput | undefined {
  if (status === 'disabled') {
    return { isActive: false }
  }
  if (status === 'upcoming') {
    return { isActive: true, startsAt: { gt: now } }
  }
  if (status === 'expired') {
    return { isActive: true, endsAt: { lte: now } }
  }
  if (status === 'active') {
    return {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    }
  }
  return undefined
}

function listWhere(
  query: AdminPromotionQuery,
  now: Date,
): Prisma.PromotionWhereInput {
  const filters: Prisma.PromotionWhereInput[] = []

  const statusFilter = statusWhere(query.status, now)
  if (statusFilter) {
    filters.push(statusFilter)
  }

  if (query.discountType === 'percentage') {
    filters.push({ discountType: 'PERCENTAGE' })
  } else if (query.discountType === 'fixed') {
    filters.push({ discountType: 'FIXED_AMOUNT' })
  }

  if (query.search) {
    filters.push({
      OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.length === 0) {
    return {}
  }
  if (filters.length === 1) {
    return filters[0]
  }
  return { AND: filters }
}

function moneyOrNull(value: string | null | undefined): Prisma.Decimal | null {
  if (value === undefined || value === null) {
    return null
  }
  return new Prisma.Decimal(value)
}

function validatePromotionFields(input: {
  discountType: Promotion['discountType']
  discountValue: Prisma.Decimal
  minimumOrderValue: Prisma.Decimal | null
  startsAt: Date
  endsAt: Date
}): void {
  assertPromotionSchedule(input.startsAt, input.endsAt)
  assertDiscountConfiguration(input.discountType, input.discountValue)
  assertMinimumOrderValue(input.minimumOrderValue)
}

function auditActionForUpdate(
  existing: Promotion,
  nextIsActive: boolean,
): 'PROMOTION_ACTIVATED' | 'PROMOTION_DEACTIVATED' | 'PROMOTION_UPDATED' {
  if (existing.isActive && !nextIsActive) {
    return 'PROMOTION_DEACTIVATED'
  }
  if (!existing.isActive && nextIsActive) {
    return 'PROMOTION_ACTIVATED'
  }
  return 'PROMOTION_UPDATED'
}

export async function listAdminPromotions(query: AdminPromotionQuery): Promise<{
  data: AdminPromotionDto[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    active: number
    upcoming: number
    expired: number
    disabled: number
  }
}> {
  const now = new Date()
  const where = listWhere(query, now)
  const skip = (query.page - 1) * query.limit

  const [total, promotions, active, upcoming, expired, disabled] =
    await prisma.$transaction([
      prisma.promotion.count({ where }),
      prisma.promotion.findMany({
        where,
        orderBy: promotionOrderBy(query.sort),
        skip,
        take: query.limit,
      }),
      prisma.promotion.count({
        where: {
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      }),
      prisma.promotion.count({
        where: { isActive: true, startsAt: { gt: now } },
      }),
      prisma.promotion.count({
        where: { isActive: true, endsAt: { lte: now } },
      }),
      prisma.promotion.count({
        where: { isActive: false },
      }),
    ])

  return {
    data: promotions.map((promotion) => toAdminPromotionDto(promotion, now)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
    summary: { active, upcoming, expired, disabled },
  }
}

export async function getAdminPromotion(
  promotionId: string,
): Promise<AdminPromotionDto> {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
  })

  if (!promotion) {
    throw new AppError(404, 'Promotion not found')
  }

  return toAdminPromotionDto(promotion)
}

export async function createPromotion(
  input: CreatePromotionInput,
  actorId: string,
): Promise<AdminPromotionDto> {
  const discountValue = new Prisma.Decimal(input.discountValue)
  const minimumOrderValue = moneyOrNull(input.minimumOrderValue)

  validatePromotionFields({
    discountType: input.discountType,
    discountValue,
    minimumOrderValue,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  })

  try {
    const promotion = await prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          code: input.code,
          description: input.description ?? null,
          discountType: input.discountType,
          discountValue,
          minimumOrderValue,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          isActive: input.isActive,
        },
      })

      await writeAuditLog(tx, {
        userId: actorId,
        action: 'PROMOTION_CREATED',
        entityType: 'Promotion',
        entityId: created.id,
        metadata: {
          code: created.code,
          discountType: created.discountType,
          isActive: created.isActive,
        },
      })

      return created
    })

    return toAdminPromotionDto(promotion)
  } catch (error) {
    throwIfUniqueConflict(error, {
      code: 'A promotion with this code already exists.',
    })
    throw error
  }
}

export async function updatePromotion(
  promotionId: string,
  input: UpdatePromotionInput,
  actorId: string,
): Promise<AdminPromotionDto> {
  const existing = await prisma.promotion.findUnique({
    where: { id: promotionId },
  })

  if (!existing) {
    throw new AppError(404, 'Promotion not found')
  }

  const nextDiscountType = input.discountType ?? existing.discountType
  const nextDiscountValue =
    input.discountValue !== undefined
      ? new Prisma.Decimal(input.discountValue)
      : existing.discountValue
  const nextMinimum =
    input.minimumOrderValue !== undefined
      ? moneyOrNull(input.minimumOrderValue)
      : existing.minimumOrderValue
  const nextStartsAt = input.startsAt ?? existing.startsAt
  const nextEndsAt = input.endsAt ?? existing.endsAt
  const nextIsActive = input.isActive ?? existing.isActive

  validatePromotionFields({
    discountType: nextDiscountType,
    discountValue: nextDiscountValue,
    minimumOrderValue: nextMinimum,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
  })

  const action = auditActionForUpdate(existing, nextIsActive)

  try {
    const promotion = await prisma.$transaction(async (tx) => {
      const updated = await tx.promotion.update({
        where: { id: promotionId },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.discountType !== undefined
            ? { discountType: input.discountType }
            : {}),
          ...(input.discountValue !== undefined
            ? { discountValue: nextDiscountValue }
            : {}),
          ...(input.minimumOrderValue !== undefined
            ? { minimumOrderValue: nextMinimum }
            : {}),
          ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })

      await writeAuditLog(tx, {
        userId: actorId,
        action,
        entityType: 'Promotion',
        entityId: updated.id,
        metadata: {
          code: updated.code,
          discountType: updated.discountType,
          isActive: updated.isActive,
        },
      })

      return updated
    })

    return toAdminPromotionDto(promotion)
  } catch (error) {
    throwIfUniqueConflict(error, {
      code: 'A promotion with this code already exists.',
    })
    throw error
  }
}

async function loadCartMerchandiseSubtotal(userId: string): Promise<{
  subtotal: Prisma.Decimal
}> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: true },
      },
    },
  })

  if (!cart || cart.items.length === 0) {
    throw new AppError(409, 'Your cart is empty')
  }

  let subtotal = ZERO

  for (const item of cart.items) {
    if (!item.product.isActive) {
      throw new AppError(409, 'Product is no longer available')
    }
    subtotal = subtotal.plus(item.product.price.mul(item.quantity))
  }

  return { subtotal: toMoneyDecimal(subtotal) }
}

export async function validatePromotionForUser(
  userId: string,
  code: string,
): Promise<PromotionPreviewDto> {
  const { subtotal } = await loadCartMerchandiseSubtotal(userId)

  const promotion = await prisma.promotion.findUnique({
    where: { code },
  })

  if (!promotion) {
    throw new AppError(404, 'Promotion code was not found.')
  }

  assertPromotionUsable(promotion, subtotal)

  const discountAmount = calculateDiscountAmount(
    subtotal,
    promotion.discountType,
    promotion.discountValue,
  )
  const totalAfterDiscount = subtotal.minus(discountAmount)

  return {
    code: promotion.code,
    description: promotion.description,
    discountType: promotion.discountType,
    discountValue: toMoneyString(promotion.discountValue),
    minimumOrderValue:
      promotion.minimumOrderValue === null
        ? null
        : toMoneyString(promotion.minimumOrderValue),
    subtotal: toMoneyString(subtotal),
    discountAmount: toMoneyString(discountAmount),
    totalAfterDiscount: toMoneyString(totalAfterDiscount),
  }
}

export async function resolveCheckoutPromotion(
  client: Prisma.TransactionClient,
  code: string,
  subtotal: Prisma.Decimal,
): Promise<{
  promotionCode: string
  discountAmount: Prisma.Decimal
}> {
  const promotion = await client.promotion.findUnique({
    where: { code },
  })

  if (!promotion) {
    throw new AppError(404, 'Promotion code was not found.')
  }

  assertPromotionUsable(promotion, subtotal)

  return {
    promotionCode: promotion.code,
    discountAmount: calculateDiscountAmount(
      subtotal,
      promotion.discountType,
      promotion.discountValue,
    ),
  }
}
