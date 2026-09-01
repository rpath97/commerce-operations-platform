import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'

export function NotFoundPage() {
  useDocumentTitle('Page not found | Noryx')

  return (
    <section className="page-wrap py-20 text-center">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Page not found
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base text-muted">
        That address is not part of this storefront.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary">
          Home
        </Link>
        <Link to="/shop" className="btn-secondary">
          Shop
        </Link>
      </div>
    </section>
  )
}
