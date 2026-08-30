import { Link } from 'react-router-dom'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="page-wrap grid min-w-0 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-base font-semibold text-ink">
            CommerceOps
          </p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
            A demonstration storefront for catalogue browsing and an
            authenticated shopping cart. Checkout and orders are not available
            yet.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Shop
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/shop" className="text-muted hover:text-ink">
                All products
              </Link>
            </li>
            <li>
              <Link to="/categories" className="text-muted hover:text-ink">
                Categories
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Customer
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/account" className="text-muted hover:text-ink">
                Account
              </Link>
            </li>
            <li>
              <Link
                to="/orders"
                className="text-muted hover:text-ink"
                aria-disabled="true"
              >
                Orders
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Company
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/about" className="text-muted hover:text-ink">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-muted hover:text-ink">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="page-wrap py-5 text-xs text-muted">
          © {year} CommerceOps. Demo catalogue only.
        </p>
      </div>
    </footer>
  )
}
