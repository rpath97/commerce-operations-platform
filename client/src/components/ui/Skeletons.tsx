type SkeletonProps = {
  className?: string
}

function Pulse({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-stone-200/80 ${className}`}
      aria-hidden="true"
    />
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper">
      <Pulse className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <Pulse className="h-3 w-20" />
        <Pulse className="h-5 w-3/4" />
        <Pulse className="h-4 w-16" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid min-w-0 grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function CategoryGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-3"
      aria-busy="true"
      aria-label="Loading categories"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-line bg-paper"
        >
          <Pulse className="h-36 rounded-none" />
          <div className="space-y-3 p-5">
            <Pulse className="h-5 w-32" />
            <Pulse className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div
      className="grid gap-10 lg:grid-cols-2 lg:gap-16"
      aria-busy="true"
      aria-label="Loading product"
    >
      <Pulse className="min-h-80 rounded-3xl lg:min-h-[28rem]" />
      <div className="space-y-4">
        <Pulse className="h-4 w-24" />
        <Pulse className="h-9 w-3/4" />
        <Pulse className="h-6 w-28" />
        <Pulse className="h-24 w-full" />
        <Pulse className="h-12 w-40" />
      </div>
    </div>
  )
}
