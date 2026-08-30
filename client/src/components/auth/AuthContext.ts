import { createContext } from 'react'
import type { AuthUser } from '../../types/auth.ts'

export type AuthContextValue = {
  user: AuthUser | null
  status: 'loading' | 'ready'
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)
