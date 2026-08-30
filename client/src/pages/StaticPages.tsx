import { PlaceholderPage } from './PlaceholderPage.tsx'

export function AboutPage() {
  return (
    <PlaceholderPage
      title="About"
      heading="A catalogue demonstration"
      message="CommerceOps is a portfolio storefront for browsing products and managing a shopping cart. It is not a live retail business."
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

export function OrdersPage() {
  return (
    <PlaceholderPage
      title="Orders"
      heading="Orders are not available"
      message="Order history depends on checkout, which is not part of this release."
    />
  )
}
