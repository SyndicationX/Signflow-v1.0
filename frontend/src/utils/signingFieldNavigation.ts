import type { DocumentField } from '../types'
import { getRadioGroupId, isRadioGroupFilled, isRadioSelected } from './radioField'

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

/**
 * Fields Next and Previous should visit, in reading order.
 * Every field is included, including each radio option and optional fields.
 * Completion does not remove a field from this list.
 */
export function navigationFieldsForSigner(
  _role: string | undefined,
  fields: DocumentField[],
): DocumentField[] {
  return [...fields].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })
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
