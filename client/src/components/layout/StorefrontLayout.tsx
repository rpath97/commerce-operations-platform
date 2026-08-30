import { Outlet } from 'react-router-dom'
import { CartNotice } from '../cart/CartNotice.tsx'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'

export function StorefrontLayout() {
  return (
    <div className="flex min-h-svh w-full min-w-0 flex-col bg-canvas text-ink">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="min-w-0 w-full flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartNotice />
    </div>
  )
}
