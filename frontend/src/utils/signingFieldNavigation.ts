import type { DocumentField } from '../types'
import { getRadioGroupFields, getRadioGroupId, isRadioGroupFilled, isRadioSelected } from './radioField'

export function isSignerFieldComplete(
  field: DocumentField,
  fields: DocumentField[],
  fieldValues: Record<string, string>,
): boolean {
  if (field.type === 'radio') {
    const groupId = getRadioGroupId(field, fields)
    return groupId
      ? isRadioGroupFilled(fields, fieldValues, groupId)
      : isRadioSelected(fieldValues, field.id)
  }
  return Boolean(fieldValues[field.id])
}

function inReadingOrder(fields: DocumentField[]): DocumentField[] {
  return [...fields].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })
}

/**
 * Fields Next and Previous should visit, in reading order.
 * A radio group is one stop. Other fields, including optional ones, stay in the list.
 * Completion does not remove a field from this list.
 */
export function navigationFieldsForSigner(
  _role: string | undefined,
  fields: DocumentField[],
): DocumentField[] {
  const seenGroups = new Set<string>()
  const result: DocumentField[] = []

  for (const field of inReadingOrder(fields)) {
    if (field.type === 'radio') {
      const groupId = getRadioGroupId(field, fields)
      if (groupId) {
        if (seenGroups.has(groupId)) continue
        seenGroups.add(groupId)
      }
    }
    result.push(field)
  }

  return result
}

/** Every option in the active radio group, or the single active field. */
export function activeFieldIdsForNavigation(
  active: DocumentField | undefined,
  fields: DocumentField[],
): Set<string> {
  if (!active) return new Set()
  if (active.type !== 'radio') return new Set([active.id])
  const groupId = getRadioGroupId(active, fields)
  if (!groupId) return new Set([active.id])
  return new Set(getRadioGroupFields(fields, groupId).map((field) => field.id))
}

/** Map a clicked option back to the group's single navigation stop. */
export function navigationIndexForField(
  navigationFields: DocumentField[],
  fields: DocumentField[],
  fieldId: string,
): number {
  const direct = navigationFields.findIndex((field) => field.id === fieldId)
  if (direct >= 0) return direct

  const field = fields.find((item) => item.id === fieldId)
  if (!field || field.type !== 'radio') return -1
  const groupId = getRadioGroupId(field, fields)
  if (!groupId) return -1

  return navigationFields.findIndex(
    (item) => item.type === 'radio' && getRadioGroupId(item, fields) === groupId,
  )
}

/** Next eligible field. Filled fields stay in the sequence. */
export function nextFieldIndex(fieldCount: number, currentIndex: number): number {
  if (fieldCount === 0 || currentIndex >= fieldCount - 1) return -1
  return currentIndex + 1
}

export function previousRequiredIndex(requiredCount: number, currentIndex: number): number {
  if (requiredCount === 0 || currentIndex <= 0) return -1
  return Math.min(currentIndex, requiredCount) - 1
}
