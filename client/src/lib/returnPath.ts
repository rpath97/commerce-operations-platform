const AUTH_PAGES = new Set(['/login', '/register'])

export function getSafeReturnPath(raw: string | null | undefined): string {
  if (!raw) {
    return '/shop'
  }

  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) {
    return '/shop'
  }

  const pathOnly = raw.split('?')[0] ?? raw
  if (AUTH_PAGES.has(pathOnly)) {
    return '/shop'
  }

  return raw
}

export function loginPath(from: string): string {
  const safe = getSafeReturnPath(from)
  return `/login?from=${encodeURIComponent(safe)}`
}

export function registerPath(from: string): string {
  const safe = getSafeReturnPath(from)
  return `/register?from=${encodeURIComponent(safe)}`
}
