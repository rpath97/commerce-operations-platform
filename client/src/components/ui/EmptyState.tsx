import { Link } from 'react-router-dom'

type EmptyStateProps = {
  title: string
  message: string
  action?: {
    label: string
    to?: string
    onClick?: () => void
  }
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
      {action?.to ? (
        <Link to={action.to} className="btn-secondary mt-6 inline-flex min-h-11">
          {action.label}
        </Link>
      ) : null}
      {action?.onClick ? (
        <button
          type="button"
          className="btn-secondary mt-6 inline-flex min-h-11"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
