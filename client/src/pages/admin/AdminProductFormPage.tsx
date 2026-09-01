import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listAdminCategories } from '../../api/adminCategories.ts'
import {
  createAdminProduct,
  getAdminProduct,
  updateAdminProduct,
} from '../../api/adminProducts.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import {
  getApiErrorMessage,
  isNotFoundError,
  isRequestAborted,
} from '../../lib/http.ts'
import { describeMoneyInput, MONEY_PATTERN } from '../../lib/moneyInput.ts'
import type { AdminCategory, AdminProduct } from '../../types/admin.ts'

type ProductFormPageProps = {
  mode: 'create' | 'edit'
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export function AdminProductFormPage({ mode }: ProductFormPageProps) {
  const { id: productId } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [loadStatus, setLoadStatus] = useState<
    'loading' | 'ready' | 'error' | 'missing'
  >('loading')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [initialQuantity, setInitialQuantity] = useState('0')
  const [lowStockThreshold, setLowStockThreshold] = useState('5')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useDocumentTitle(
    mode === 'create'
      ? 'Add product | Admin | Noryx'
      : 'Edit product | Admin | Noryx',
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')

    const categoryPromise = listAdminCategories(controller.signal)
    const productPromise =
      mode === 'edit' && productId
        ? getAdminProduct(productId, controller.signal)
        : Promise.resolve(null)

    Promise.all([categoryPromise, productPromise])
      .then(([nextCategories, nextProduct]) => {
        setCategories(nextCategories)
        if (mode === 'edit') {
          if (!nextProduct) {
            setLoadStatus('missing')
            return
          }
          setProduct(nextProduct)
          setName(nextProduct.name)
          setSlug(nextProduct.slug)
          setDescription(nextProduct.description)
          setSku(nextProduct.sku)
          setPrice(nextProduct.price)
          setCategoryId(nextProduct.category.id)
          setIsActive(nextProduct.isActive)
        } else if (nextCategories[0]) {
          setCategoryId(nextCategories[0].id)
        }
        setLoadStatus('ready')
      })
      .catch((caught: unknown) => {
        if (isRequestAborted(caught)) {
          return
        }
        setLoadStatus(isNotFoundError(caught) ? 'missing' : 'error')
      })

    return () => controller.abort()
  }, [mode, productId])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      setSlug(slugFromName(value))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const priceError = describeMoneyInput(price)
    if (priceError) {
      setError(priceError)
      return
    }
    if (!MONEY_PATTERN.test(price.trim())) {
      setError('Enter a valid price with up to 2 decimal places.')
      return
    }

    if (mode === 'create') {
      const quantity = Number.parseInt(initialQuantity, 10)
      const threshold = Number.parseInt(lowStockThreshold, 10)
      if (!Number.isInteger(quantity) || quantity < 0) {
        setError(
          'Initial inventory quantity must be zero or a positive whole number.',
        )
        return
      }
      if (!Number.isInteger(threshold) || threshold < 0) {
        setError('Low-stock threshold must be zero or a positive whole number.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === 'create') {
        await createAdminProduct({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          sku: sku.trim(),
          price: price.trim(),
          categoryId,
          initialInventoryQuantity: Number.parseInt(initialQuantity, 10),
          lowStockThreshold: Number.parseInt(lowStockThreshold, 10),
          isActive,
        })
      } else if (productId) {
        await updateAdminProduct(productId, {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          sku: sku.trim(),
          price: price.trim(),
          categoryId,
          isActive,
        })
      }
      navigate('/admin/products')
    } catch (caught: unknown) {
      setError(
        getApiErrorMessage(
          caught,
          'Unable to save this product. Check the fields and try again.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loadStatus === 'loading') {
    return <p className="text-sm text-muted">Loading product form…</p>
  }

  if (loadStatus === 'error') {
    return (
      <p className="text-sm text-muted">
        We could not load this form. Refresh and try again.
      </p>
    )
  }

  if (loadStatus === 'missing' || (mode === 'edit' && !product)) {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-ink">Product not found</h1>
        <Link to="/admin/products" className="btn-secondary mt-6 inline-flex">
          Back to products
        </Link>
      </section>
    )
  }

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Products
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {mode === 'create' ? 'Add product' : 'Edit product'}
      </h1>

      <form
        className="mt-8 max-w-xl min-w-0 space-y-4"
        onSubmit={handleSubmit}
        noValidate
        autoComplete="off"
      >
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}

        <div>
          <label htmlFor="product-name" className="text-sm font-medium text-ink">
            Name
          </label>
          <input
            id="product-name"
            className="input-field mt-1.5"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            required
            maxLength={200}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="product-slug" className="text-sm font-medium text-ink">
            Slug
          </label>
          <input
            id="product-slug"
            className="input-field mt-1.5"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            required
            maxLength={200}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="product-description" className="text-sm font-medium text-ink">
            Description
          </label>
          <textarea
            id="product-description"
            className="input-field mt-1.5 min-h-32"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            maxLength={4000}
          />
        </div>

        <div>
          <label htmlFor="product-sku" className="text-sm font-medium text-ink">
            SKU
          </label>
          <input
            id="product-sku"
            className="input-field mt-1.5"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            required
            maxLength={64}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="product-price" className="text-sm font-medium text-ink">
            Price
          </label>
          <input
            id="product-price"
            className="input-field mt-1.5"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
            inputMode="decimal"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="product-category" className="text-sm font-medium text-ink">
            Category
          </label>
          <select
            id="product-category"
            className="input-field mt-1.5"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Active</legend>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Product is active in the storefront
          </label>
        </fieldset>

        {mode === 'create' ? (
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-ink">
              Initial inventory
            </legend>
            <div>
              <label htmlFor="product-qty" className="text-sm text-muted">
                Initial inventory quantity
              </label>
              <input
                id="product-qty"
                className="input-field mt-1.5"
                value={initialQuantity}
                onChange={(event) => setInitialQuantity(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="product-threshold" className="text-sm text-muted">
                Low-stock threshold
              </label>
              <input
                id="product-threshold"
                className="input-field mt-1.5"
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save product'}
          </button>
          <Link to="/admin/products" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}
