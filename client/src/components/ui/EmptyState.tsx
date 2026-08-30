import { Link } from 'react-router-dom'

type EmptyStateProps = {
  title: string
  message: string
  action?: {
    to: string
    label: string
  }
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
      {action ? (
        <Link to={action.to} className="btn-secondary mt-6 inline-flex">
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
