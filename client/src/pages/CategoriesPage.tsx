import { useCallback, useEffect, useState } from 'react'
import { listCategories } from '../api/catalogue.ts'
import { CategoryCard } from '../components/catalogue/CategoryCard.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import { CategoryGridSkeleton } from '../components/ui/Skeletons.tsx'
import { isRequestAborted } from '../lib/http.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import type { Category } from '../types/catalogue.ts'

export function CategoriesPage() {
  useDocumentTitle('Categories | Noryx')
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback((signal?: AbortSignal) => {
    setStatus('loading')
    listCategories(signal)
      .then((data) => {
        setCategories(data)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (isRequestAborted(error) || signal?.aborted) {
          return
        }
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return (
    <section className="page-wrap py-10 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Categories
        </h1>
        <p className="mt-2 text-sm text-muted">
          Choose a range to open the shop with that filter applied.
        </p>
      </header>

      <div className="mt-8">
        {status === 'loading' ? <CategoryGridSkeleton /> : null}
        {status === 'error' ? (
          <ErrorState
            message="We couldn't load categories right now."
            onRetry={() => load()}
          />
        ) : null}
        {status === 'ready' && categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            message="There are no categories to display."
            action={{ to: '/shop', label: 'Browse products' }}
          />
        ) : null}
        {status === 'ready' && categories.length > 0 ? (
          <ul className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id} className="min-w-0">
                <CategoryCard category={category} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
