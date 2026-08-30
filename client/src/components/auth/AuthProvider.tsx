import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../../api/auth.ts'
import { isRequestAborted } from '../../lib/http.ts'
import type { AuthUser } from '../../types/auth.ts'
import { AuthContext, type AuthContextValue } from './AuthContext.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      return currentUser
    } catch {
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    getCurrentUser(controller.signal)
      .then((currentUser) => {
        setUser(currentUser)
      })
      .catch((error: unknown) => {
        if (isRequestAborted(error)) {
          return
        }
        setUser(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setStatus('ready')
        }
      })

    return () => controller.abort()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const currentUser = await loginUser({ email, password })
    setUser(currentUser)
    setStatus('ready')
  }, [])

  const register = useCallback(
    async (input: {
      firstName: string
      lastName: string
      email: string
      password: string
    }) => {
      const currentUser = await registerUser(input)
      setUser(currentUser)
      setStatus('ready')
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, status, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
