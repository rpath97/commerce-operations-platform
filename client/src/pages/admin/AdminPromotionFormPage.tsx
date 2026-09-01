import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createAdminPromotion,
  getAdminPromotion,
  updateAdminPromotion,
} from '../../api/adminPromotions.ts'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
} from '../../lib/datetimeLocal.ts'
import {
  getApiErrorMessage,
  isNotFoundError,
  isRequestAborted,
} from '../../lib/http.ts'
import { describeMoneyInput, MONEY_PATTERN } from '../../lib/moneyInput.ts'
import type { DiscountType } from '../../types/promotion.ts'

type PromotionFormPageProps = {
  mode: 'create' | 'edit'
}

const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/

export function AdminPromotionFormPage({ mode }: PromotionFormPageProps) {
  const { promotionId } = useParams()
  const navigate = useNavigate()
  const [loadStatus, setLoadStatus] = useState<
    'loading' | 'ready' | 'error' | 'missing'
  >(mode === 'create' ? 'ready' : 'loading')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [minimumOrderValue, setMinimumOrderValue] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useDocumentTitle(
    mode === 'create'
      ? 'Create promotion | Admin | Noryx'
      : 'Edit promotion | Admin | Noryx',
  )

  useEffect(() => {
    if (mode !== 'edit' || !promotionId) {
      return
    }

    const controller = new AbortController()
    setLoadStatus('loading')
    getAdminPromotion(promotionId, controller.signal)
      .then((promotion) => {
        setCode(promotion.code)
        setDescription(promotion.description ?? '')
        setDiscountType(promotion.discountType)
        setDiscountValue(promotion.discountValue)
        setMinimumOrderValue(promotion.minimumOrderValue ?? '')
        setStartsAt(isoToDatetimeLocal(promotion.startsAt))
        setEndsAt(isoToDatetimeLocal(promotion.endsAt))
        setIsActive(promotion.isActive)
        setLoadStatus('ready')
      })
      .catch((caught: unknown) => {
        if (isRequestAborted(caught)) {
          return
        }
        setLoadStatus(isNotFoundError(caught) ? 'missing' : 'error')
      })

    return () => controller.abort()
  }, [mode, promotionId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const normalizedCode = code.trim().toUpperCase()
    if (!CODE_PATTERN.test(normalizedCode)) {
      setError(
        'Code must be 3–32 characters using letters, numbers, hyphen, or underscore.',
      )
      return
    }

    const valueError = describeMoneyInput(discountValue)
    if (valueError || !MONEY_PATTERN.test(discountValue.trim())) {
      setError(
        discountType === 'PERCENTAGE'
          ? 'Enter a percentage between 0.01 and 100 with up to 2 decimal places.'
          : 'Enter a fixed discount amount greater than zero.',
      )
      return
    }

    if (discountType === 'PERCENTAGE') {
      const percent = Number.parseFloat(discountValue)
      if (!(percent > 0) || percent > 100) {
        setError('Percentage discounts must be greater than 0 and at most 100.')
        return
      }
    }

    if (minimumOrderValue.trim()) {
      const minError = describeMoneyInput(minimumOrderValue)
      if (minError || !MONEY_PATTERN.test(minimumOrderValue.trim())) {
        setError('Minimum order value must be a non-negative amount.')
        return
      }
    }

    const startsIso = datetimeLocalToIso(startsAt)
    const endsIso = datetimeLocalToIso(endsAt)
    if (!startsIso || !endsIso) {
      setError('Enter a valid start and end date.')
      return
    }
    if (new Date(endsIso).getTime() <= new Date(startsIso).getTime()) {
      setError('End date must be after the start date.')
      return
    }

    const payload = {
      code: normalizedCode,
      description: description.trim() ? description.trim() : null,
      discountType,
      discountValue: discountValue.trim(),
      minimumOrderValue: minimumOrderValue.trim()
        ? minimumOrderValue.trim()
        : null,
      startsAt: startsIso,
      endsAt: endsIso,
      isActive,
    }

    setSubmitting(true)
    try {
      if (mode === 'create') {
        await createAdminPromotion(payload)
      } else if (promotionId) {
        await updateAdminPromotion(promotionId, payload)
      }
      navigate('/admin/promotions')
    } catch (caught: unknown) {
      setError(
        getApiErrorMessage(
          caught,
          'Unable to save this promotion. Check the fields and try again.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loadStatus === 'loading') {
    return <p className="text-sm text-muted">Loading promotion form…</p>
  }

  if (loadStatus === 'error') {
    return (
      <p className="text-sm text-muted">
        We could not load this form. Refresh and try again.
      </p>
    )
  }

  if (loadStatus === 'missing') {
    return (
      <section>
        <h1 className="text-2xl font-semibold text-ink">Promotion not found</h1>
        <Link to="/admin/promotions" className="btn-secondary mt-6 inline-flex">
          Back to promotions
        </Link>
      </section>
    )
  }

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Promotions
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {mode === 'create' ? 'Create promotion' : 'Edit promotion'}
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
          <label htmlFor="promo-code" className="text-sm font-medium text-ink">
            Code
          </label>
          <input
            id="promo-code"
            className="input-field mt-1.5 uppercase"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            required
            maxLength={32}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted">
            3–32 characters. Letters, numbers, hyphen, and underscore.
          </p>
        </div>

        <div>
          <label htmlFor="promo-description" className="text-sm font-medium text-ink">
            Description
          </label>
          <textarea
            id="promo-description"
            className="input-field mt-1.5 min-h-24"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Discount type</legend>
          <div className="mt-2 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="discount-type"
                checked={discountType === 'PERCENTAGE'}
                onChange={() => setDiscountType('PERCENTAGE')}
              />
              Percentage
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="discount-type"
                checked={discountType === 'FIXED_AMOUNT'}
                onChange={() => setDiscountType('FIXED_AMOUNT')}
              />
              Fixed amount
            </label>
          </div>
        </fieldset>

        <div>
          <label htmlFor="promo-value" className="text-sm font-medium text-ink">
            {discountType === 'PERCENTAGE'
              ? 'Percentage'
              : 'Fixed discount amount'}
          </label>
          <input
            id="promo-value"
            className="input-field mt-1.5"
            value={discountValue}
            onChange={(event) => setDiscountValue(event.target.value)}
            required
            inputMode="decimal"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted">
            {discountType === 'PERCENTAGE'
              ? '1–100%'
              : 'Amount in Australian dollars (A$).'}
          </p>
        </div>

        <div>
          <label htmlFor="promo-min" className="text-sm font-medium text-ink">
            Minimum order value
          </label>
          <input
            id="promo-min"
            className="input-field mt-1.5"
            value={minimumOrderValue}
            onChange={(event) => setMinimumOrderValue(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted">
            Optional. Leave blank for no minimum. Amounts use A$.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="promo-start" className="text-sm font-medium text-ink">
              Start date and time
            </label>
            <input
              id="promo-start"
              type="datetime-local"
              className="input-field mt-1.5"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="promo-end" className="text-sm font-medium text-ink">
              End date and time
            </label>
            <input
              id="promo-end"
              type="datetime-local"
              className="input-field mt-1.5"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Availability</legend>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Promotion is enabled
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save promotion'}
          </button>
          <Link to="/admin/promotions" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}
