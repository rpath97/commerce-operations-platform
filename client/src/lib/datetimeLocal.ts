function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function datetimeLocalToIso(value: string): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
