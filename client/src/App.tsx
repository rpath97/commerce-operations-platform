import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthProvider.tsx'
import { StorefrontLayout } from './components/layout/StorefrontLayout.tsx'
import { CategoriesPage } from './pages/CategoriesPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ProductDetailPage } from './pages/ProductDetailPage.tsx'
import { ShopPage } from './pages/ShopPage.tsx'
import {
  AboutPage,
  AccountPage,
  CartPage,
  ContactPage,
  LoginPage,
  OrdersPage,
  RegisterPage,
} from './pages/StaticPages.tsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<StorefrontLayout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="products/:slug" element={<ProductDetailPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
