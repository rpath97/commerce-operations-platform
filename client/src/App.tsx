import { Route, Routes } from 'react-router-dom'
import { AdminGuard } from './components/admin/AdminGuard.tsx'
import { AdminLayout } from './components/admin/AdminLayout.tsx'
import { AuthProvider } from './components/auth/AuthProvider.tsx'
import { CartProvider } from './components/cart/CartProvider.tsx'
import { StorefrontLayout } from './components/layout/StorefrontLayout.tsx'
import { AccountPage } from './pages/AccountPage.tsx'
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage.tsx'
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.tsx'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx'
import { AdminInventoryDetailPage } from './pages/admin/AdminInventoryDetailPage.tsx'
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage.tsx'
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage.tsx'
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage.tsx'
import { AdminPromotionFormPage } from './pages/admin/AdminPromotionFormPage.tsx'
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage.tsx'
import { AdminProductFormPage } from './pages/admin/AdminProductFormPage.tsx'
import { AdminProductsPage } from './pages/admin/AdminProductsPage.tsx'
import { CartPage } from './pages/CartPage.tsx'
import { CategoriesPage } from './pages/CategoriesPage.tsx'
import { CheckoutPage } from './pages/CheckoutPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { OrderDetailPage } from './pages/OrderDetailPage.tsx'
import { OrdersPage } from './pages/OrdersPage.tsx'
import { ProductDetailPage } from './pages/ProductDetailPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { ShopPage } from './pages/ShopPage.tsx'
import { AboutPage, ContactPage } from './pages/StaticPages.tsx'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Routes>
          <Route path="admin" element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route
                path="products/new"
                element={<AdminProductFormPage mode="create" />}
              />
              <Route
                path="products/:id/edit"
                element={<AdminProductFormPage mode="edit" />}
              />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="inventory" element={<AdminInventoryPage />} />
              <Route
                path="inventory/:productId"
                element={<AdminInventoryDetailPage />}
              />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
              <Route path="promotions" element={<AdminPromotionsPage />} />
              <Route
                path="promotions/new"
                element={<AdminPromotionFormPage mode="create" />}
              />
              <Route
                path="promotions/:promotionId/edit"
                element={<AdminPromotionFormPage mode="edit" />}
              />
            </Route>
          </Route>
          <Route element={<StorefrontLayout />}>
            <Route index element={<HomePage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="products/:slug" element={<ProductDetailPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </CartProvider>
    </AuthProvider>
  )
}
