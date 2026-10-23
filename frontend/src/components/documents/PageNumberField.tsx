import { useEffect, useState } from 'react'

interface PageNumberFieldProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** Type a page number and press Enter, or leave the field, to open that page. */
export function PageNumberField({ page, totalPages, onPageChange }: PageNumberFieldProps) {
  const [draft, setDraft] = useState(String(page))

  useEffect(() => {
    setDraft(String(page))
  }, [page])

  const commit = () => {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(String(page))
      return
    }
    const next = Math.max(1, Math.min(totalPages, parsed))
    setDraft(String(next))
    if (next !== page) onPageChange(next)
  }

  const digits = Math.max(2, String(totalPages).length)

  return (
    <label className="pdf-page-jump">
      Page
      <input
        className="pdf-page-jump-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`Page number, 1 to ${totalPages}`}
        value={draft}
        style={{ width: `${digits + 1.5}ch` }}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          commit()
          event.currentTarget.blur()
        }}
      />
      <span>of {totalPages}</span>
    </label>
  )
}
