type ProductVisualProps = {
  categorySlug: string
  categoryName: string
  productName: string
  className?: string
}

const PALETTES: Record<string, { from: string; to: string; accent: string }> = {
  electronics: { from: '#080d09', to: '#18231a', accent: '#b7ff00' },
  fitness: { from: '#0b100c', to: '#23301f', accent: '#9cff2e' },
  'home-lifestyle': { from: '#0d110e', to: '#29302a', accent: '#f7faf5' },
}

const FALLBACK = { from: '#090d0a', to: '#202a22', accent: '#b7ff00' }

export function ProductVisual({
  categorySlug,
  categoryName,
  productName,
  className = '',
}: ProductVisualProps) {
  const palette = PALETTES[categorySlug] ?? FALLBACK

  return (
    <div
      className={`relative min-w-0 w-full overflow-hidden contain-paint ${className}`}
      role="img"
      aria-label={`${productName} visual placeholder, ${categoryName}`}
      style={{ backgroundColor: palette.from }}
    >
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          width: '45%',
          aspectRatio: '1',
          right: '8%',
          top: '6%',
          backgroundColor: palette.accent,
          opacity: 0.12,
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          width: '35%',
          aspectRatio: '1',
          left: '6%',
          bottom: '10%',
          backgroundColor: palette.accent,
          opacity: 0.08,
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute left-[12%] top-[16%] h-2 w-[35%] rounded-sm"
        style={{ backgroundColor: palette.accent, opacity: 0.35 }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute left-[12%] top-[24%] h-2 w-[22%] rounded-sm"
        style={{ backgroundColor: palette.accent, opacity: 0.22 }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute right-0 bottom-0 h-[58%] w-[38%]"
        style={{ backgroundColor: palette.to, opacity: 0.72 }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-black/55 px-4 py-3">
        <p className="text-xs font-medium tracking-[0.16em] text-white/90 uppercase">
          {categoryName}
        </p>
      </div>
    </div>
  )
}
