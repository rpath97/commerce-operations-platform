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
  useDocumentTitle('Home | Noryx')
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
      <section className="relative overflow-hidden border-b border-line bg-[#050805]">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-brand"
          aria-hidden="true"
        />
        <div className="page-wrap relative py-18 sm:py-24 lg:py-28">
          <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">
            Noryx commerce platform
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.5rem] lg:leading-tight">
            Run commerce with clarity.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Browse the storefront, manage secure customer accounts, place demo
            orders, and operate catalogue, inventory, promotions, and analytics
            from one connected platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary">
              Explore products
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
              Start with a range, then refine the catalogue.
            </p>
          </div>
          <Link to="/categories" className="hidden text-sm font-semibold text-brand sm:inline">
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
                Recently added items from the demo catalogue.
              </p>
            </div>
            <Link to="/shop" className="hidden text-sm font-semibold text-brand sm:inline">
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
        <h2 className="sr-only">Platform features</h2>
        <ul className="grid gap-6 sm:grid-cols-3">
          <li className="rounded-lg border border-line bg-paper px-5 py-6 transition hover:border-brand/30">
            <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
              Secure
            </p>
            <h3 className="mt-2 text-sm font-semibold text-ink">
              Account-based shopping
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              HTTP-only cookie sessions protect customer and administrator flows.
            </p>
          </li>
          <li className="rounded-lg border border-line bg-paper px-5 py-6 transition hover:border-brand/30">
            <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
              Connected
            </p>
            <h3 className="mt-2 text-sm font-semibold text-ink">
              Inventory-aware operations
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Stock, orders, promotions, and operational analytics share one data model.
            </p>
          </li>
          <li className="rounded-lg border border-line bg-paper px-5 py-6 transition hover:border-brand/30">
            <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
              Practical
            </p>
            <h3 className="mt-2 text-sm font-semibold text-ink">
              End-to-end demo checkout
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Customers can manage carts and place persistent demo orders without real payments.
            </p>
          </li>
        </ul>
      </section>
    </div>
  )
}
