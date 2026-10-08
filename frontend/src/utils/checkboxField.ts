import type { DocumentField } from '../types'

const MAX_HORIZONTAL_OFFSET = 25

function isCheckboxSibling(field: DocumentField, source: DocumentField): boolean {
  return (
    field.type === 'checkbox' &&
    field.recipientId === source.recipientId &&
    field.page === source.page
  )
}

/**
 * Checkboxes stacked under one another in the same column. Unlike radios these
 * carry no group id, so the column is derived from placement alone.
 */
export function getCheckboxColumnFields(
  fields: DocumentField[],
  source: DocumentField,
): DocumentField[] {
  if (source.type !== 'checkbox') return []
  if (source.radioGroupId) {
    const explicit = fields
      .filter(
        (field) =>
          field.type === 'checkbox' &&
          field.recipientId === source.recipientId &&
          field.page === source.page &&
          field.radioGroupId === source.radioGroupId,
      )
      .sort((a, b) => a.y - b.y || a.x - b.x)

    if (explicit.length > 0) return explicit
  }

  const sorted = fields
    .filter((field) => isCheckboxSibling(field, source))
    .sort((a, b) => a.x - b.x || a.y - b.y)

  let cluster: DocumentField[] = []
  for (const candidate of sorted) {
    const previous = cluster[cluster.length - 1]
    if (!previous) {
      cluster.push(candidate)
      continue
    }

    const sameColumn = Math.abs(candidate.x - previous.x) <= MAX_HORIZONTAL_OFFSET
    if (sameColumn) {
      cluster.push(candidate)
      continue
    }

    if (cluster.some((field) => field.id === source.id)) return cluster
    cluster = [candidate]
  }

  return cluster.some((field) => field.id === source.id) ? cluster : [source]
}

/** Checkbox N — continues from how many are already in the column. */
export function getNextCheckboxOptionLabel(columnFields: DocumentField[]): string {
  return `Checkbox ${columnFields.length + 1}`
}
