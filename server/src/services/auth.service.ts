import { Prisma } from '@prisma/client'
import type { PublicUser } from '../config/auth.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import {
  dummyPasswordCheck,
  hashPassword,
  passwordsMatch,
} from '../utils/password.js'
import { signAuthToken } from '../utils/jwt.js'
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js'

const INVALID_CREDENTIALS = 'Invalid email or password'

function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  }
}

export async function registerUser(
  input: RegisterInput,
): Promise<{ user: PublicUser; token: string }> {
  const passwordHash = await hashPassword(input.password)

  try {
    const user = await prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        role: 'CUSTOMER',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    })

    const token = signAuthToken({ userId: user.id, role: user.role })

    return { user: toPublicUser(user), token }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError(409, 'An account with this email already exists')
    }

    throw error
  }
}

export async function loginUser(
  input: LoginInput,
): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  })

  if (!user) {
    await dummyPasswordCheck(input.password)
    throw new AppError(401, INVALID_CREDENTIALS)
  }

  const matches = await passwordsMatch(input.password, user.passwordHash)

  if (!matches) {
    throw new AppError(401, INVALID_CREDENTIALS)
  }

  const publicUser = toPublicUser({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  })

  const token = signAuthToken({ userId: user.id, role: user.role })

  return { user: publicUser, token }
}
