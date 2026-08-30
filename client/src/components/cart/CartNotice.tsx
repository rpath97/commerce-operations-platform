import { useCart } from './useCart.ts'

export function CartNotice() {
  const { notice } = useCart()

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <p
        role="status"
        aria-live="polite"
        className={`max-w-sm rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink shadow-md ${
          notice ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {notice ?? ''}
      </p>
    </div>
  )
}
