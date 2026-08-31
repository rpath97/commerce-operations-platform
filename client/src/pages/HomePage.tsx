import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, listProducts } from '../api/catalogue.ts'
import { CategoryCard } from '../components/catalogue/CategoryCard.tsx'
import { ProductGrid } from '../components/catalogue/ProductGrid.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { ErrorState } from '../components/ui/ErrorState.tsx'
import {
  CategoryGridSkeleton,
  ProductGridSkeleton,
} from '../components/ui/Skeletons.tsx'
import { isRequestAborted } from '../lib/http.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import type { Category, Product } from '../types/catalogue.ts'

export function HomePage() {
  useDocumentTitle('Home | CommerceOps')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categoryStatus, setCategoryStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [productStatus, setProductStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')

  const loadCategories = useCallback((signal?: AbortSignal) => {
    setCategoryStatus('loading')
    listCategories(signal)
      .then((data) => {
        setCategories(data)
        setCategoryStatus('ready')
      })
      .catch((error: unknown) => {
        if (isRequestAborted(error) || signal?.aborted) {
          return
        }
        setCategoryStatus('error')
      })
  }, [])

  const loadProducts = useCallback((signal?: AbortSignal) => {
    setProductStatus('loading')
    listProducts({ limit: 6, sort: 'newest', page: 1 }, signal)
      .then((result) => {
        setProducts(result.data)
        setProductStatus('ready')
      })
      .catch((error: unknown) => {
        if (isRequestAborted(error) || signal?.aborted) {
          return
        }
        setProductStatus('error')
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadCategories(controller.signal)
    loadProducts(controller.signal)
    return () => controller.abort()
  }, [loadCategories, loadProducts])

  return (
    <div>
      <section className="border-b border-line bg-paper">
        <div className="page-wrap py-16 sm:py-20 lg:py-24">
          <p className="text-sm font-medium tracking-[0.18em] text-muted uppercase">
            CommerceOps catalogue
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.25rem] lg:leading-tight">
            Everything you need, in one place.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Browse a focused product range across electronics, fitness, and home.
            This is a working catalogue demonstration, not a live retailer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary">
              Shop products
            </Link>
            <Link to="/categories" className="btn-secondary">
              Browse categories
            </Link>
          </div>
        </div>
      </section>

      <section className="page-wrap py-14 sm:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Shop by category
            </h2>
            <p className="mt-2 text-sm text-muted">
              Start with a range, then refine in the catalogue.
            </p>
          </div>
          <Link to="/categories" className="hidden text-sm font-medium text-brand sm:inline">
            View all
          </Link>
        </div>
        {categoryStatus === 'loading' ? <CategoryGridSkeleton /> : null}
        {categoryStatus === 'error' ? (
          <ErrorState
            message="We couldn't load categories right now."
            onRetry={() => loadCategories()}
          />
        ) : null}
        {categoryStatus === 'ready' && categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            message="Categories will appear here once they are published."
          />
        ) : null}
        {categoryStatus === 'ready' && categories.length > 0 ? (
          <ul className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id} className="min-w-0">
                <CategoryCard category={category} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="border-y border-line bg-paper">
        <div className="page-wrap py-14 sm:py-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                Latest products
              </h2>
              <p className="mt-2 text-sm text-muted">
                A selection of recently added catalogue items.
              </p>
            </div>
            <Link to="/shop" className="hidden text-sm font-medium text-brand sm:inline">
              Shop all
            </Link>
          </div>
          {productStatus === 'loading' ? (
            <ProductGridSkeleton count={6} />
          ) : null}
          {productStatus === 'error' ? (
            <ErrorState
              message="We couldn't load products right now."
              onRetry={() => loadProducts()}
            />
          ) : null}
          {productStatus === 'ready' && products.length === 0 ? (
            <EmptyState
              title="No products yet"
              message="Products will appear here once they are published."
              action={{ to: '/shop', label: 'Go to shop' }}
            />
          ) : null}
          {productStatus === 'ready' && products.length > 0 ? (
            <ProductGrid products={products} />
          ) : null}
        </div>
      </section>

      <section className="page-wrap py-14 sm:py-16">
        <h2 className="sr-only">Store features</h2>
        <ul className="grid gap-6 sm:grid-cols-3">
          <li className="rounded-2xl border border-line bg-paper px-5 py-6">
            <h3 className="text-sm font-semibold text-ink">
              Secure account access
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sessions use HTTP-only cookies. Sign-in screens will follow in a
              later release.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-paper px-5 py-6">
            <h3 className="text-sm font-semibold text-ink">
              Inventory-aware shopping
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Availability is taken from live stock data, including out-of-stock
              items.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-paper px-5 py-6">
            <h3 className="text-sm font-semibold text-ink">
              Simple order experience
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Cart and checkout are planned next. This catalogue is browse-only
              for now.
            </p>
          </li>
        </ul>
      </section>
    </div>
  )
}
