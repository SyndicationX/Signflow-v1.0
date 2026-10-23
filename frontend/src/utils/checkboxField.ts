import type { DocumentField } from '../types'

/**
 * Checkboxes added with + share radioGroupId, including options continued onto the next page.
 * A newly placed checkbox does not join an existing group.
 */
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
        field.radioGroupId === groupId,
    )
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
}

/** Checkbox N — continues from how many are already in the column. */
export function getNextCheckboxOptionLabel(columnFields: DocumentField[]): string {
  return `Checkbox ${columnFields.length + 1}`
}
