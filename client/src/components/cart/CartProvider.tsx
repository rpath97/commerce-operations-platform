import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from '../../api/cart.ts'
import {
  getApiErrorMessage,
  isRequestAborted,
  isUnauthorizedError,
} from '../../lib/http.ts'
import { emptyCart, type Cart } from '../../types/cart.ts'
import { useAuth } from '../auth/useAuth.ts'
import { CartContext, type CartStatus } from './CartContext.ts'

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus, refreshUser } = useAuth()
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [status, setStatus] = useState<CartStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingKeys, setPendingKeys] = useState<string[]>([])
  const pendingRef = useRef(new Set<string>())
  const noticeTimer = useRef<number | undefined>(undefined)

  const showNotice = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null)
    }, 3200)
  }, [])

  useEffect(() => {
    return () => window.clearTimeout(noticeTimer.current)
  }, [])

  const loadCart = useCallback(
    async (signal?: AbortSignal) => {
      if (authStatus !== 'ready' || !user) {
        setCart(emptyCart)
        setError(null)
        setStatus('ready')
        return
      }

      setStatus('loading')
      setError(null)

      try {
        const next = await getCart(signal)
        setCart(next)
        setStatus('ready')
      } catch (caught: unknown) {
        if (isRequestAborted(caught) || signal?.aborted) {
          return
        }

        if (isUnauthorizedError(caught)) {
          await refreshUser()
          setCart(emptyCart)
          setStatus('ready')
          return
        }

        setError('We could not load your cart.')
        setStatus('error')
      }
    },
    [authStatus, user, refreshUser],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadCart(controller.signal)
    return () => controller.abort()
  }, [loadCart])

  const runMutation = useCallback(
    async (
      key: string,
      action: () => Promise<Cart>,
      successMessage: string,
    ) => {
      if (pendingRef.current.has(key)) {
        return
      }

      pendingRef.current.add(key)
      setPendingKeys(Array.from(pendingRef.current))
      setError(null)

      try {
        const next = await action()
        setCart(next)
        setStatus('ready')
        showNotice(successMessage)
      } catch (caught: unknown) {
        if (isUnauthorizedError(caught)) {
          await refreshUser()
          setCart(emptyCart)
          return
        }

        throw new Error(getApiErrorMessage(caught))
      } finally {
        pendingRef.current.delete(key)
        setPendingKeys(Array.from(pendingRef.current))
      }
    },
    [refreshUser, showNotice],
  )

  const addItem = useCallback(
    async (productId: string, quantity: number) => {
      await runMutation(
        `add:${productId}`,
        () => addCartItem(productId, quantity),
        'Added to cart',
      )
    },
    [runMutation],
  )

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      await runMutation(
        `update:${itemId}`,
        () => updateCartItem(itemId, quantity),
        'Quantity updated',
      )
    },
    [runMutation],
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      await runMutation(
        `remove:${itemId}`,
        () => removeCartItem(itemId),
        'Removed from cart',
      )
    },
    [runMutation],
  )

  const clearItems = useCallback(async () => {
    await runMutation('clear', () => clearCart(), 'Cart cleared')
  }, [runMutation])

  const refreshCart = useCallback(async () => {
    await loadCart()
  }, [loadCart])

  const value = useMemo(
    () => ({
      cart,
      status,
      notice,
      error,
      pendingKeys,
      itemCount: cart.summary.itemCount,
      refreshCart,
      addItem,
      updateQuantity,
      removeItem,
      clearItems,
    }),
    [
      cart,
      status,
      notice,
      error,
      pendingKeys,
      refreshCart,
      addItem,
      updateQuantity,
      removeItem,
      clearItems,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
