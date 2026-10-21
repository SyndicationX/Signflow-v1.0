const SIGNING_FIELD_TYPES = new Set(['signature', 'initial']);

type SigningFieldRow = {
  id: string;
  type: string;
  recipient_id: string;
  label?: string | null;
};

/** Spouse signature is a separate mark and must not inherit the investor signature. */
function isSpouseSignatureField(field: SigningFieldRow): boolean {
  return field.type === 'signature' && /\bspouse\b/i.test(String(field.label ?? ''));
}

export function replicateRecipientSignatureFieldValues(
  recipientFields: SigningFieldRow[],
  fieldValues: Record<string, string>,
): Record<string, string> {
  const merged = { ...fieldValues };

  for (const fieldType of SIGNING_FIELD_TYPES) {
    const sourceField = recipientFields.find(
      (field) =>
        field.type === fieldType &&
        !isSpouseSignatureField(field) &&
        String(merged[field.id] ?? '').trim(),
    );
    if (!sourceField) continue;

    const sourceValue = String(merged[sourceField.id]).trim();
    for (const field of recipientFields) {
      if (field.type !== fieldType) continue;
      if (field.id === sourceField.id) continue;
      if (isSpouseSignatureField(field)) continue;
      if (String(merged[field.id] ?? '').trim()) continue;
      merged[field.id] = sourceValue;
    }
  }

  return merged;
}
