import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from '../../api/adminCategories.ts'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../components/ui/EmptyState.tsx'
import { ErrorState } from '../../components/ui/ErrorState.tsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.ts'
import {
  getApiErrorMessage,
  isConflictError,
  isRequestAborted,
} from '../../lib/http.ts'
import type { AdminCategory } from '../../types/admin.ts'

type FormState = {
  name: string
  slug: string
  description: string
}

const emptyForm: FormState = { name: '', slug: '', description: '' }

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null)
  const [deleting, setDeleting] = useState(false)

  useDocumentTitle('Categories | Admin | CommerceOps')

  const load = useCallback((signal?: AbortSignal) => {
    setStatus('loading')
    listAdminCategories(signal)
      .then((data) => {
        setCategories(data)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (isRequestAborted(error)) {
          return
        }
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  function startEdit(category: AdminCategory) {
    setEditingId(category.id)
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
    })
    setFormError(null)
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
    }

    try {
      if (editingId) {
        await updateAdminCategory(editingId, payload)
        setNotice('Category updated.')
      } else {
        await createAdminCategory(payload)
        setNotice('Category created.')
      }
      resetForm()
      load()
    } catch (error: unknown) {
      setFormError(getApiErrorMessage(error, 'Unable to save this category.'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }
    setDeleting(true)
    setNotice(null)
    try {
      await deleteAdminCategory(deleteTarget.id)
      setNotice('Category deleted.')
      setDeleteTarget(null)
      load()
    } catch (error: unknown) {
      setDeleteTarget(null)
      if (isConflictError(error)) {
        setNotice(
          'This category cannot be deleted while products are assigned to it.',
        )
      } else {
        setNotice(getApiErrorMessage(error, 'Unable to delete this category.'))
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="min-w-0">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        Catalogue
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        Categories
      </h1>

      <form
        className="mt-8 max-w-xl min-w-0 space-y-4 rounded-2xl border border-line bg-paper p-4"
        onSubmit={handleSubmit}
        autoComplete="off"
        noValidate
      >
        <h2 className="text-lg font-semibold">
          {editingId ? 'Edit category' : 'Create category'}
        </h2>
        {formError ? (
          <p role="alert" className="text-sm text-ink">
            {formError}
          </p>
        ) : null}
        <div>
          <label htmlFor="category-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="category-name"
            className="input-field mt-1.5"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="category-slug" className="text-sm font-medium">
            Slug
          </label>
          <input
            id="category-slug"
            className="input-field mt-1.5"
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: event.target.value })}
            required
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="category-description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="category-description"
            className="input-field mt-1.5 min-h-24"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create category'}
          </button>
          {editingId ? (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {notice ? (
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          {notice}
        </p>
      ) : null}

      {status === 'loading' ? (
        <p className="mt-8 text-sm text-muted">Loading categories…</p>
      ) : null}

      {status === 'error' ? (
        <div className="mt-8">
          <ErrorState
            message="We could not load categories."
            onRetry={() => load()}
          />
        </div>
      ) : null}

      {status === 'ready' && categories.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No categories"
            message="Create a category before adding products."
          />
        </div>
      ) : null}

      {status === 'ready' && categories.length > 0 ? (
        <>
          <ul className="mt-8 grid gap-3 lg:hidden">
            {categories.map((category) => (
              <li
                key={category.id}
                className="min-w-0 rounded-2xl border border-line bg-paper p-4"
              >
                <p className="break-words font-medium">{category.name}</p>
                <p className="mt-1 break-all text-sm text-muted">{category.slug}</p>
                <p className="mt-2 text-sm text-muted">
                  {category.productCount} products
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => startEdit(category)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDeleteTarget(category)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Slug</th>
                  <th className="py-3 pr-4 font-medium">Products</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b border-line">
                    <td className="py-3 pr-4 font-medium">{category.name}</td>
                    <td className="py-3 pr-4 break-all">{category.slug}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {category.productCount}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="font-medium text-brand"
                          onClick={() => startEdit(category)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="font-medium text-brand"
                          onClick={() => setDeleteTarget(category)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete this category?"
          message="This cannot be undone. Categories with products assigned cannot be deleted."
          confirmLabel="Delete category"
          cancelLabel="Keep category"
          busy={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </section>
  )
}
