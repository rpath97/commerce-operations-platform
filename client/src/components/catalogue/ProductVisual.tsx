type ProductVisualProps = {
  categorySlug: string
  categoryName: string
  productName: string
  className?: string
}

const PALETTES: Record<string, { from: string; to: string; accent: string }> = {
  electronics: { from: '#1e3a4c', to: '#3d6b7a', accent: '#d6e8ee' },
  fitness: { from: '#2f4a3c', to: '#5c7a62', accent: '#dde8d8' },
  'home-lifestyle': { from: '#5c4033', to: '#8b6b55', accent: '#f0e4d4' },
}

const FALLBACK = { from: '#2c3338', to: '#5a656c', accent: '#e4e7e8' }

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
      style={{
        backgroundImage: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
      }}
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
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/35 to-transparent px-4 py-3">
        <p className="text-xs font-medium tracking-[0.16em] text-white/90 uppercase">
          {categoryName}
        </p>
      </div>
    </div>
  )
}
