import { createContext } from 'react'
import type { AuthUser } from '../../types/auth.ts'

export type AuthContextValue = {
  user: AuthUser | null
  status: 'loading' | 'ready'
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    firstName: string
    lastName: string
    email: string
    password: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<AuthUser | null>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
