import { type FormEvent } from 'react'
import type { AddressInput } from '../../types/address.ts'

type AddressFormProps = {
  value: AddressInput
  onChange: (value: AddressInput) => void
  onSubmit: () => void
  submitting: boolean
  submitLabel: string
  error?: string | null
  idPrefix: string
}

export function AddressForm({
  value,
  onChange,
  onSubmit,
  submitting,
  submitLabel,
  error,
  idPrefix,
}: AddressFormProps) {
  function update<K extends keyof AddressInput>(key: K, next: AddressInput[K]) {
    onChange({ ...value, [key]: next })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={handleSubmit} noValidate>
      {error ? (
        <p role="alert" className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink">
          {error}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-first-name`} className="text-sm font-medium text-ink">
            First name
          </label>
          <input
            id={`${idPrefix}-first-name`}
            name="firstName"
            autoComplete="given-name"
            required
            value={value.firstName}
            onChange={(event) => update('firstName', event.target.value)}
            className="input-field mt-1.5"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-last-name`} className="text-sm font-medium text-ink">
            Last name
          </label>
          <input
            id={`${idPrefix}-last-name`}
            name="lastName"
            autoComplete="family-name"
            required
            value={value.lastName}
            onChange={(event) => update('lastName', event.target.value)}
            className="input-field mt-1.5"
          />
        </div>
      </div>

      <div className="min-w-0">
        <label htmlFor={`${idPrefix}-line1`} className="text-sm font-medium text-ink">
          Address line 1
        </label>
        <input
          id={`${idPrefix}-line1`}
          name="addressLine1"
          autoComplete="street-address"
          required
          value={value.addressLine1}
          onChange={(event) => update('addressLine1', event.target.value)}
          className="input-field mt-1.5"
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`${idPrefix}-line2`} className="text-sm font-medium text-ink">
          Address line 2
          <span className="font-normal text-muted"> (optional)</span>
        </label>
        <input
          id={`${idPrefix}-line2`}
          name="addressLine2"
          autoComplete="address-line2"
          value={value.addressLine2 ?? ''}
          onChange={(event) => update('addressLine2', event.target.value)}
          className="input-field mt-1.5"
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`${idPrefix}-suburb`} className="text-sm font-medium text-ink">
          Suburb
        </label>
        <input
          id={`${idPrefix}-suburb`}
          name="suburb"
          autoComplete="address-level2"
          required
          value={value.suburb}
          onChange={(event) => update('suburb', event.target.value)}
          className="input-field mt-1.5"
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-state`} className="text-sm font-medium text-ink">
            State
          </label>
          <input
            id={`${idPrefix}-state`}
            name="state"
            autoComplete="address-level1"
            required
            value={value.state}
            onChange={(event) => update('state', event.target.value)}
            className="input-field mt-1.5"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-postcode`} className="text-sm font-medium text-ink">
            Postcode
          </label>
          <input
            id={`${idPrefix}-postcode`}
            name="postcode"
            autoComplete="postal-code"
            required
            value={value.postcode}
            onChange={(event) => update('postcode', event.target.value)}
            className="input-field mt-1.5"
          />
        </div>
      </div>

      <div className="min-w-0">
        <label htmlFor={`${idPrefix}-country`} className="text-sm font-medium text-ink">
          Country
        </label>
        <input
          id={`${idPrefix}-country`}
          name="country"
          autoComplete="country-name"
          required
          value={value.country}
          onChange={(event) => update('country', event.target.value)}
          className="input-field mt-1.5"
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`${idPrefix}-phone`} className="text-sm font-medium text-ink">
          Phone
          <span className="font-normal text-muted"> (optional)</span>
        </label>
        <input
          id={`${idPrefix}-phone`}
          name="phone"
          type="tel"
          autoComplete="tel"
          value={value.phone ?? ''}
          onChange={(event) => update('phone', event.target.value)}
          className="input-field mt-1.5"
        />
      </div>

      <button type="submit" className="btn-primary justify-self-start" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
