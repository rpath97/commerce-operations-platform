import { PlaceholderPage } from './PlaceholderPage.tsx'

export function AboutPage() {
  return (
    <PlaceholderPage
      title="About"
      heading="A catalogue demonstration"
      message="CommerceOps is a portfolio storefront for browsing products and categories. It is not a live retail business."
    />
  )
}

export function ContactPage() {
  return (
    <PlaceholderPage
      title="Contact"
      heading="Contact is not open yet"
      message="There is no support inbox for this demonstration store. Use the catalogue to explore products."
    />
  )
}

export function AccountPage() {
  return (
    <PlaceholderPage
      title="Account"
      heading="Account pages are not ready"
      message="You can already hold a session through the API. Customer account screens will be added later."
    />
  )
}

export function OrdersPage() {
  return (
    <PlaceholderPage
      title="Orders"
      heading="Orders are not available"
      message="Order history depends on checkout, which is not part of this release."
    />
  )
}

export function LoginPage() {
  return (
    <PlaceholderPage
      title="Log in"
      heading="Sign in is coming later"
      message="Login and registration screens are not in this release. Existing API sessions still appear in the header when a cookie is present."
    />
  )
}

export function RegisterPage() {
  return (
    <PlaceholderPage
      title="Register"
      heading="Registration screens are coming later"
      message="Public registration exists on the API. This storefront does not collect new accounts yet."
    />
  )
}

export function CartPage() {
  return (
    <PlaceholderPage
      title="Cart"
      heading="Your cart is empty for now"
      message="Shopping cart and quantity updates are planned for a later phase. Nothing has been added."
    />
  )
}
