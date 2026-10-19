import type { DocumentField } from '../types'

export function resolveRadioGroupIds(fields: DocumentField[]): Map<string, string> {
  const assignment = new Map<string, string>()

  for (const field of fields) {
    if (field.type !== 'radio') continue
    // Only options created with + share a radioGroupId. A new placement does not
    // join a nearby group.
    assignment.set(field.id, field.radioGroupId?.trim() || field.id)
  }

  return assignment
}

export function getRadioGroupId(
  field: Pick<DocumentField, 'id' | 'type' | 'radioGroupId'>,
  fields?: DocumentField[],
): string | undefined {
  if (field.type !== 'radio') return undefined
  if (fields) {
    return resolveRadioGroupIds(fields).get(field.id) ?? field.radioGroupId ?? field.id
  }
  return field.radioGroupId ?? field.id
}

export function getRadioGroupFields(fields: DocumentField[], groupId: string): DocumentField[] {
  const resolved = resolveRadioGroupIds(fields)
  return fields.filter(
    (field) => field.type === 'radio' && resolved.get(field.id) === groupId,
  )
}

export function isRadioSelected(fieldValues: Record<string, string>, fieldId: string): boolean {
  return fieldValues[fieldId] === 'selected'
}

export function isRadioGroupFilled(
  fields: DocumentField[],
  fieldValues: Record<string, string>,
  groupId: string,
): boolean {
  return getRadioGroupFields(fields, groupId).some((field) => isRadioSelected(fieldValues, field.id))
}

/**
 * Saved radio values for one signing session.
 * A group with a stored choice keeps that choice and clears its other options.
 * Groups with no stored choice are left untouched, so unrelated radios stay independent.
 */
export function restoreSavedRadioValues(fields: DocumentField[]): Record<string, string> {
  const resolved = resolveRadioGroupIds(fields)
  const grouped = new Map<string, DocumentField[]>()

  for (const field of fields) {
    if (field.type !== 'radio') continue
    const groupId = resolved.get(field.id) ?? field.id
    const group = grouped.get(groupId) ?? []
    group.push(field)
    grouped.set(groupId, group)
  }

  const updates: Record<string, string> = {}
  for (const groupFields of grouped.values()) {
    const selected = groupFields.filter((field) => field.value === 'selected')
    if (selected.length === 0) continue

    const keeperId = selected[0].id
    for (const field of groupFields) {
      updates[field.id] = field.id === keeperId ? 'selected' : ''
    }
  }

  return updates
}

/** Apply mutual exclusion: one selected option per radio group. */
export function buildRadioGroupSelectionUpdates(
  fields: DocumentField[],
  selectedFieldId: string,
): Record<string, string> {
  const field = fields.find((item) => item.id === selectedFieldId)
  if (!field || field.type !== 'radio') {
    return { [selectedFieldId]: 'selected' }
  }

  const groupId = getRadioGroupId(field, fields)
  if (!groupId) {
    return { [selectedFieldId]: 'selected' }
  }

  const updates: Record<string, string> = {}
  for (const groupField of getRadioGroupFields(fields, groupId)) {
    updates[groupField.id] = groupField.id === selectedFieldId ? 'selected' : ''
  }
  return updates
}

/** One entry per radio group for progress / required checks */
export function collapseRadioGroupsForValidation(fields: DocumentField[]): DocumentField[] {
  const resolved = resolveRadioGroupIds(fields)
  const seenGroups = new Set<string>()
  const result: DocumentField[] = []

  for (const field of fields) {
    if (field.type === 'radio') {
      const groupId = resolved.get(field.id)
      if (!groupId || seenGroups.has(groupId)) continue
      seenGroups.add(groupId)
    }
    result.push(field)
  }

  return result
}

export function areRequiredFieldsComplete(
  fields: DocumentField[],
  fieldValues: Record<string, string>,
): boolean {
  const required = collapseRadioGroupsForValidation(fields.filter((field) => field.required))

  return required.every((field) => {
    if (field.type === 'radio') {
      const groupId = getRadioGroupId(field, fields)
      return groupId ? isRadioGroupFilled(fields, fieldValues, groupId) : isRadioSelected(fieldValues, field.id)
    }
    return Boolean(fieldValues[field.id])
  })
}

export function getNextRadioOptionLabel(fields: DocumentField[], groupId: string): string {
  return `Option ${getRadioGroupFields(fields, groupId).length + 1}`
}
