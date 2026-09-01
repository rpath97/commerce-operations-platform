import { Link } from 'react-router-dom'
import { BrandLogo } from '../brand/BrandLogo.tsx'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-line bg-[#050805]">
      <div className="page-wrap grid min-w-0 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <BrandLogo
            markClassName="h-8 w-8"
            wordmarkClassName="text-lg"
          />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            A demonstration commerce platform for catalogue browsing, secure
            customer accounts, shopping carts, checkout, and operational admin
            workflows. No payment is collected.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Shop
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/shop" className="text-muted hover:text-brand">
                All products
              </Link>
            </li>
            <li>
              <Link to="/categories" className="text-muted hover:text-brand">
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
              <Link to="/account" className="text-muted hover:text-brand">
                Account
              </Link>
            </li>
            <li>
              <Link to="/orders" className="text-muted hover:text-brand">
                Orders
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Platform
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/about" className="text-muted hover:text-brand">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-muted hover:text-brand">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="page-wrap py-5 text-xs text-muted">
          © {year} Noryx. Portfolio demonstration platform.
        </p>
      </div>
    </footer>
  )
}
