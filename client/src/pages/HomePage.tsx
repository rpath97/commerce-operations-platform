import { useEffect, useState } from 'react'
import { api } from '../services/api.ts'

type HealthResponse = {
  status: string
  service: string
}

type ApiState =
  | { status: 'loading' }
  | { status: 'ok'; service: string }
  | { status: 'error' }

export function HomePage() {
  const [apiState, setApiState] = useState<ApiState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    api
      .get<HealthResponse>('/health')
      .then((response) => {
        if (!cancelled) {
          setApiState({ status: 'ok', service: response.data.service })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiState({ status: 'error' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl text-center">
        <p className="mb-4 text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">
          Operations platform
        </p>
        <h1 className="text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          CommerceOps
        </h1>
        <p className="mt-5 text-lg text-slate-600 sm:text-xl">
          Full-Stack E-Commerce Operations Platform
        </p>

        <div className="mt-10 border-t border-slate-200 pt-8">
          {apiState.status === 'loading' && (
            <p className="text-sm text-slate-500">Checking API status…</p>
          )}
          {apiState.status === 'ok' && (
            <p className="text-sm text-emerald-700">
              API connected · {apiState.service}
            </p>
          )}
          {apiState.status === 'error' && (
            <p className="text-sm text-slate-500">
              API unavailable. Start the server with{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                npm run dev
              </code>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
