import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import { throwIfUniqueConflict } from '../utils/prisma-errors.js'
import { normaliseSlug } from '../utils/slug.js'
import { toPublicCategory } from './catalog.mapper.js'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/catalog.validator.js'

function resolvedSlug(value: string): string {
  const slug = normaliseSlug(value)
  if (slug.length === 0) {
    throw new AppError(400, 'Invalid slug')
  }
  return slug
}

export async function listCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  })

  return categories.map(toPublicCategory)
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
  })

  if (!category) {
    throw new AppError(404, 'Category not found')
  }

  return toPublicCategory(category)
}

export async function createCategory(input: CreateCategoryInput) {
  try {
    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug: resolvedSlug(input.slug),
        description: input.description ?? null,
      },
    })

    return toPublicCategory(category)
  } catch (error) {
    throwIfUniqueConflict(error, {
      name: 'A category with this name already exists',
      slug: 'A category with this slug already exists',
    })
    throw error
  }
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { id } })

  if (!existing) {
    throw new AppError(404, 'Category not found')
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: resolvedSlug(input.slug) } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      },
    })

    return toPublicCategory(category)
  } catch (error) {
    throwIfUniqueConflict(error, {
      name: 'A category with this name already exists',
      slug: 'A category with this slug already exists',
    })
    throw error
  }
}

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })

  if (!existing) {
    throw new AppError(404, 'Category not found')
  }

  if (existing._count.products > 0) {
    throw new AppError(
      409,
      'Cannot delete a category that still has products',
    )
  }

  await prisma.category.delete({ where: { id } }).catch((error: unknown) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new AppError(
        409,
        'Cannot delete a category that still has products',
      )
    }
    throw error
  })

  return { id }
}
