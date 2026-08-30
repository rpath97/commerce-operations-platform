import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser } from '../../api/auth.ts'
import { isRequestAborted } from '../../lib/http.ts'
import { AuthContext, type AuthContextValue } from './AuthContext.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

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

  const value = useMemo(() => ({ user, status }), [user, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
