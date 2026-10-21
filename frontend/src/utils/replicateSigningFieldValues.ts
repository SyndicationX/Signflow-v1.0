import type { DocumentField } from '../types'

const SIGNING_FIELD_TYPES = new Set(['signature', 'initial'])

export function isSigningFieldType(type: string): boolean {
  return SIGNING_FIELD_TYPES.has(type)
}

/** Spouse signature is a separate mark and must not inherit the investor signature. */
export function isSpouseSignatureField(field: {
  type: string
  label?: string
}): boolean {
  return field.type === 'signature' && /\bspouse\b/i.test(String(field.label ?? ''))
}

/**
 * When an investor signs once, apply the same mark to their other empty
 * signature/initial fields of the same type on this document.
 * Spouse signature fields stay blank until they are signed themselves.
 */
export function replicateRecipientSigningFieldValues(
  recipientFields: DocumentField[],
  fieldValues: Record<string, string>,
  sourceFieldId: string,
  sourceValue: string,
): Record<string, string> {
  const sourceField = recipientFields.find((field) => field.id === sourceFieldId)
  if (!sourceField || !isSigningFieldType(sourceField.type) || isSpouseSignatureField(sourceField)) {
    return { ...fieldValues, [sourceFieldId]: sourceValue }
  }

  const next = { ...fieldValues, [sourceFieldId]: sourceValue }

  for (const field of recipientFields) {
    if (field.id === sourceFieldId) continue
    if (field.type !== sourceField.type) continue
    if (isSpouseSignatureField(field)) continue
    if (String(next[field.id] ?? '').trim()) continue
    next[field.id] = sourceValue
  }

  return next
}

export function replicateRecipientSigningSignedAt(
  recipientFields: DocumentField[],
  signedAtByFieldId: Record<string, string>,
  sourceFieldId: string,
  signedAt: string,
): Record<string, string> {
  const sourceField = recipientFields.find((field) => field.id === sourceFieldId)
  if (!sourceField || !isSigningFieldType(sourceField.type) || isSpouseSignatureField(sourceField)) {
    return { ...signedAtByFieldId, [sourceFieldId]: signedAt }
  }

  const next = { ...signedAtByFieldId, [sourceFieldId]: signedAt }

  for (const field of recipientFields) {
    if (field.id === sourceFieldId) continue
    if (field.type !== sourceField.type) continue
    if (isSpouseSignatureField(field)) continue
    if (signedAtByFieldId[field.id]) continue
    next[field.id] = signedAt
  }

  return next
}
