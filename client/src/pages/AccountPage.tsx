import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from '../api/addresses.ts'
import { AddressForm } from '../components/address/AddressForm.tsx'
import { useAuth } from '../components/auth/useAuth.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { formatAddressLines } from '../lib/formatAddress.ts'
import { getApiErrorMessage, isRequestAborted } from '../lib/http.ts'
import { loginPath, registerPath } from '../lib/returnPath.ts'
import {
  emptyAddressInput,
  type Address,
  type AddressInput,
} from '../types/address.ts'

export function AccountPage() {
  const { user, status, logout } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressStatus, setAddressStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [formValue, setFormValue] = useState<AddressInput>(emptyAddressInput)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useDocumentTitle('Account | CommerceOps')

  const loadAddresses = useCallback(
    (signal?: AbortSignal) => {
      if (!user) {
        return
      }
      setAddressStatus('loading')
      listAddresses(signal)
        .then((data) => {
          setAddresses(data)
          setAddressStatus('ready')
        })
        .catch((error: unknown) => {
          if (isRequestAborted(error)) {
            return
          }
          setAddressStatus('error')
        })
    },
    [user],
  )

  useEffect(() => {
    if (status !== 'ready' || !user) {
      return
    }
    const controller = new AbortController()
    loadAddresses(controller.signal)
    return () => controller.abort()
  }, [status, user, loadAddresses])

  async function handleSave() {
    setFormError(null)
    setSaving(true)
    const payload = {
      ...formValue,
      addressLine2: formValue.addressLine2 || null,
      phone: formValue.phone || null,
    }

    try {
      if (editingId) {
        const updated = await updateAddress(editingId, payload)
        setAddresses((current) =>
          current.map((address) => (address.id === updated.id ? updated : address)),
        )
      } else {
        const created = await createAddress(payload)
        setAddresses((current) => [created, ...current])
      }
      setShowForm(false)
      setEditingId(null)
      setFormValue(emptyAddressInput)
    } catch (caught: unknown) {
      setFormError(getApiErrorMessage(caught, 'Unable to save this address.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(addressId: string) {
    try {
      await deleteAddress(addressId)
      setAddresses((current) => current.filter((address) => address.id !== addressId))
    } catch (caught: unknown) {
      setFormError(getApiErrorMessage(caught, 'Unable to delete this address.'))
    }
  }

  if (status === 'loading') {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <p className="text-sm text-muted">Checking your session…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page-wrap py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Sign in to your account
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Use your CommerceOps customer account to keep a cart, saved addresses,
          and orders.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={loginPath('/account')} className="btn-primary">
            Log in
          </Link>
          <Link to={registerPath('/account')} className="btn-secondary">
            Create account
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-wrap py-16 sm:py-20">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Account
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        {user.firstName} {user.lastName}
      </h1>
      <p className="mt-3 text-sm text-muted">{user.email}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {user.role === 'ADMIN' ? (
          <Link to="/admin" className="btn-primary">
            Admin console
          </Link>
        ) : null}
        <Link
          to="/orders"
          className={user.role === 'ADMIN' ? 'btn-secondary' : 'btn-primary'}
        >
          Orders
        </Link>
        <Link to="/cart" className="btn-secondary">
          View cart
        </Link>
        <button type="button" className="btn-secondary" onClick={() => void logout()}>
          Log out
        </button>
      </div>

      <section className="mt-12">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-ink">Saved addresses</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEditingId(null)
              setFormValue(emptyAddressInput)
              setShowForm(true)
              setFormError(null)
            }}
          >
            Add address
          </button>
        </div>

        {addressStatus === 'loading' ? (
          <p className="mt-4 text-sm text-muted">Loading addresses…</p>
        ) : null}
        {addressStatus === 'error' ? (
          <p className="mt-4 text-sm text-ink">We could not load saved addresses.</p>
        ) : null}
        {addressStatus === 'ready' && addresses.length === 0 && !showForm ? (
          <p className="mt-4 text-sm text-muted">No saved addresses yet.</p>
        ) : null}

        <ul className="mt-6 space-y-4">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="min-w-0 rounded-2xl border border-line bg-paper p-5"
            >
              <p className="text-sm leading-6 break-words text-ink">
                {formatAddressLines(address).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-ink underline-offset-2 hover:underline"
                  onClick={() => {
                    setEditingId(address.id)
                    setFormValue({
                      firstName: address.firstName,
                      lastName: address.lastName,
                      addressLine1: address.addressLine1,
                      addressLine2: address.addressLine2 ?? '',
                      suburb: address.suburb,
                      state: address.state,
                      postcode: address.postcode,
                      country: address.country,
                      phone: address.phone ?? '',
                    })
                    setShowForm(true)
                    setFormError(null)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
                  onClick={() => void handleDelete(address.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {showForm ? (
          <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
            <h3 className="text-base font-semibold text-ink">
              {editingId ? 'Edit address' : 'New address'}
            </h3>
            <div className="mt-4">
              <AddressForm
                idPrefix="account"
                value={formValue}
                onChange={setFormValue}
                onSubmit={() => void handleSave()}
                submitting={saving}
                submitLabel={editingId ? 'Save changes' : 'Save address'}
                error={formError}
              />
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}
