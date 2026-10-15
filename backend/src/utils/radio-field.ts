export interface RadioFieldLike {
  id: string;
  type: string;
  recipientId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  radioGroupId?: string | null;
}

export function resolveRadioGroupIds<T extends RadioFieldLike>(fields: T[]): Map<string, string> {
  const assignment = new Map<string, string>();

  for (const field of fields) {
    if (field.type !== 'radio') continue;
    // Only options created with + share a radioGroupId. A new placement does not
    // join a nearby group.
    const groupId = field.radioGroupId?.trim();
    assignment.set(field.id, groupId || field.id);
  }

  return assignment;
}

export function applyResolvedRadioGroups<T extends RadioFieldLike>(fields: T[]): T[] {
  const resolved = resolveRadioGroupIds(
    fields.map((field) => ({
      ...field,
      id: field.id,
    })),
  );
  return fields.map((field) => {
    if (field.type !== 'radio') return field;
    const radioGroupId = resolved.get(field.id);
    if (!radioGroupId || radioGroupId === field.radioGroupId) return field;
    return { ...field, radioGroupId };
  });
}
