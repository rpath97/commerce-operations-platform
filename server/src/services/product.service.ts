import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import { throwIfUniqueConflict } from '../utils/prisma-errors.js'
import { normaliseSlug } from '../utils/slug.js'
import { toAdminProduct, toPublicProduct } from './catalog.mapper.js'
import type {
  CreateProductInput,
  ProductQuery,
  UpdateInventoryInput,
  UpdateProductInput,
} from '../validators/catalog.validator.js'

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
  sort: ProductQuery['sort'],
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

export async function createProduct(input: CreateProductInput) {
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

export async function updateProduct(id: string, input: UpdateProductInput) {
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

  try {
    const product = await prisma.product.update({
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
) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { inventory: true },
  })

  if (!product || !product.inventory) {
    throw new AppError(404, 'Product inventory not found')
  }

  const inventory = await prisma.inventory.update({
    where: { productId: id },
    data: {
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.lowStockThreshold !== undefined
        ? { lowStockThreshold: input.lowStockThreshold }
        : {}),
    },
  })

  return {
    productId: id,
    quantity: inventory.quantity,
    lowStockThreshold: inventory.lowStockThreshold,
    inStock: inventory.quantity > 0,
  }
}

export async function archiveProduct(id: string) {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  })

  if (!existing) {
    throw new AppError(404, 'Product not found')
  }

  const product = await prisma.product.update({
    where: { id },
    data: { isActive: false },
    include: productInclude,
  })

  return toAdminProduct(product)
}
