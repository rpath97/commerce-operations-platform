import { Prisma } from '@prisma/client'
import { writeAuditLog } from '../lib/audit.js'
import { writeInventoryMovement } from '../lib/inventory-movement.js'
import { applyLegacyInventoryUpdate } from './inventory.service.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import { throwIfUniqueConflict } from '../utils/prisma-errors.js'
import { normaliseSlug } from '../utils/slug.js'
import type { AdminProductQuery } from '../validators/admin.validator.js'
import type {
  CreateProductInput,
  ProductQuery,
  UpdateInventoryInput,
  UpdateProductInput,
} from '../validators/catalog.validator.js'
import { toAdminProduct, toPublicProduct } from './catalog.mapper.js'

const productInclude = {
  category: true,
  inventory: true,
} as const

function resolvedSlug(value: string): string {
  const slug = normaliseSlug(value)
  if (slug.length === 0) {
    throw new AppError(400, 'Invalid slug')
  }
  return slug
}

function sortOrder(
  sort: ProductQuery['sort'] | AdminProductQuery['sort'],
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case 'price-asc':
      return { price: 'asc' }
    case 'price-desc':
      return { price: 'desc' }
    case 'name-asc':
      return { name: 'asc' }
    case 'name-desc':
      return { name: 'desc' }
    default:
      return { createdAt: 'desc' }
  }
}

function publicProductWhere(query: ProductQuery): Prisma.ProductWhereInput {
  const filters: Prisma.ProductWhereInput[] = [{ isActive: true }]

  if (query.search) {
    filters.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ],
    })
  }

  if (query.category) {
    filters.push({ category: { slug: query.category } })
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filters.push({
      price: {
        ...(query.minPrice !== undefined
          ? { gte: new Prisma.Decimal(query.minPrice) }
          : {}),
        ...(query.maxPrice !== undefined
          ? { lte: new Prisma.Decimal(query.maxPrice) }
          : {}),
      },
    })
  }

  if (query.inStock === true) {
    filters.push({ inventory: { quantity: { gt: 0 } } })
  }

  if (query.inStock === false) {
    filters.push({
      OR: [{ inventory: { is: null } }, { inventory: { quantity: { lte: 0 } } }],
    })
  }

  return { AND: filters }
}

function adminProductWhere(query: AdminProductQuery): Prisma.ProductWhereInput {
  const filters: Prisma.ProductWhereInput[] = []

  if (query.status === 'active') {
    filters.push({ isActive: true })
  } else if (query.status === 'archived') {
    filters.push({ isActive: false })
  }

  if (query.search) {
    filters.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ],
    })
  }

  if (query.category) {
    filters.push({ category: { slug: query.category } })
  }

  if (filters.length === 0) {
    return {}
  }

  return { AND: filters }
}

export async function listPublicProducts(query: ProductQuery) {
  const where = publicProductWhere(query)
  const skip = (query.page - 1) * query.limit

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: sortOrder(query.sort),
      skip,
      take: query.limit,
    }),
  ])

  return {
    data: products.map(toPublicProduct),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  }
}

export async function listAdminProducts(query: AdminProductQuery) {
  const where = adminProductWhere(query)
  const skip = (query.page - 1) * query.limit

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: sortOrder(query.sort),
      skip,
      take: query.limit,
    }),
  ])

  return {
    data: products.map(toAdminProduct),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  }
}

export async function getPublicProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: productInclude,
  })

  if (!product) {
    throw new AppError(404, 'Product not found')
  }

  return toPublicProduct(product)
}

export async function getAdminProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  })

  if (!product) {
    throw new AppError(404, 'Product not found')
  }

  return toAdminProduct(product)
}

export async function createProduct(
  input: CreateProductInput,
  actorId: string,
) {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
  })

  if (!category) {
    throw new AppError(400, 'Category not found')
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: input.name,
          slug: resolvedSlug(input.slug),
          description: input.description,
          sku: input.sku,
          price: new Prisma.Decimal(input.price),
          categoryId: input.categoryId,
          isActive: input.isActive,
        },
      })

      await tx.inventory.create({
        data: {
          productId: created.id,
          quantity: input.initialInventoryQuantity,
          lowStockThreshold: input.lowStockThreshold,
        },
      })

      if (input.initialInventoryQuantity > 0) {
        await writeInventoryMovement(tx, {
          productId: created.id,
          type: 'INITIAL_STOCK',
          quantityDelta: input.initialInventoryQuantity,
          quantityBefore: 0,
          quantityAfter: input.initialInventoryQuantity,
          referenceType: 'Product',
          referenceId: created.id,
          actorUserId: actorId,
        })
      }

      await writeAuditLog(tx, {
        userId: actorId,
        action: 'PRODUCT_CREATED',
        entityType: 'Product',
        entityId: created.id,
        metadata: { sku: created.sku, slug: created.slug },
      })

      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: productInclude,
      })
    })

    return toAdminProduct(product)
  } catch (error) {
    throwIfUniqueConflict(error, {
      slug: 'A product with this slug already exists',
      sku: 'A product with this SKU already exists',
    })
    throw error
  }
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  actorId: string,
) {
  const existing = await prisma.product.findUnique({ where: { id } })

  if (!existing) {
    throw new AppError(404, 'Product not found')
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
    })
    if (!category) {
      throw new AppError(400, 'Category not found')
    }
  }

  let action = 'PRODUCT_UPDATED'
  if (input.isActive === false && existing.isActive) {
    action = 'PRODUCT_ARCHIVED'
  } else if (input.isActive === true && !existing.isActive) {
    action = 'PRODUCT_RESTORED'
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: resolvedSlug(input.slug) } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.price !== undefined
            ? { price: new Prisma.Decimal(input.price) }
            : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: productInclude,
      })

      await writeAuditLog(tx, {
        userId: actorId,
        action,
        entityType: 'Product',
        entityId: updated.id,
      })

      return updated
    })

    return toAdminProduct(product)
  } catch (error) {
    throwIfUniqueConflict(error, {
      slug: 'A product with this slug already exists',
      sku: 'A product with this SKU already exists',
    })
    throw error
  }
}

export async function updateProductInventory(
  id: string,
  input: UpdateInventoryInput,
  actorId: string,
) {
  return applyLegacyInventoryUpdate(id, input, actorId)
}

export async function archiveProduct(id: string, actorId: string) {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  })

  if (!existing) {
    throw new AppError(404, 'Product not found')
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: { isActive: false },
      include: productInclude,
    })

    await writeAuditLog(tx, {
      userId: actorId,
      action: 'PRODUCT_ARCHIVED',
      entityType: 'Product',
      entityId: updated.id,
    })

    return updated
  })

  return toAdminProduct(product)
}
