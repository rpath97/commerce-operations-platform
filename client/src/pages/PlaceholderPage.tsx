import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'

type PlaceholderPageProps = {
  title: string
  heading: string
  message: string
  kicker?: string
}

export function PlaceholderPage({
  title,
  heading,
  message,
  kicker = 'Vendora',
}: PlaceholderPageProps) {
  useDocumentTitle(`${title} | Vendora`)

  return (
    <section className="page-wrap py-16 sm:py-20">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        {kicker}
      </p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted">{message}</p>
      <Link to="/shop" className="btn-primary mt-8 inline-flex">
        Continue shopping
      </Link>
    </section>
  )
}
