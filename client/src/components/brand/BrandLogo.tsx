type BrandLogoProps = {
  className?: string
  markClassName?: string
  wordmarkClassName?: string
  decorative?: boolean
}

export function BrandLogo({
  className = '',
  markClassName = 'h-8 w-8',
  wordmarkClassName = 'text-xl',
  decorative = false,
}: BrandLogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Noryx'}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src="/favicon.svg"
        alt=""
        className={`${markClassName} shrink-0`}
      />
      <span
        className={`font-display font-extrabold tracking-[0.2em] text-ink ${wordmarkClassName}`}
        aria-hidden="true"
      >
        NORY<span className="text-brand">X</span>
      </span>
    </span>
  )
}
