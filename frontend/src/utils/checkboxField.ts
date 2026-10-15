import type { DocumentField } from '../types'

/** Checkboxes added with + share radioGroupId. A newly placed checkbox does not. */
export function getCheckboxColumnFields(
  fields: DocumentField[],
  source: DocumentField,
): DocumentField[] {
  if (source.type !== 'checkbox') return []
  const groupId = source.radioGroupId?.trim()
  if (!groupId) return [source]

  return fields
    .filter(
      (field) =>
        field.type === 'checkbox' &&
        field.recipientId === source.recipientId &&
        field.page === source.page &&
        field.radioGroupId === groupId,
    )
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Checkbox N — continues from how many are already in the column. */
export function getNextCheckboxOptionLabel(columnFields: DocumentField[]): string {
  return `Checkbox ${columnFields.length + 1}`
}
