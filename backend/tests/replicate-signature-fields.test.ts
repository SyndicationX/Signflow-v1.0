import { describe, expect, it } from 'vitest';
import { replicateRecipientSignatureFieldValues } from '../src/utils/replicate-signature-fields';

describe('replicateRecipientSignatureFieldValues', () => {
  it('copies signature to empty sibling fields', () => {
    const fields = [
      { id: 'sig-1', type: 'signature', recipient_id: 'rec_investor' },
      { id: 'sig-2', type: 'signature', recipient_id: 'rec_investor' },
      { id: 'sig-3', type: 'signature', recipient_id: 'rec_investor' },
      { id: 'initial-1', type: 'initial', recipient_id: 'rec_investor' },
    ];

    const result = replicateRecipientSignatureFieldValues(fields, {
      'sig-1': 'data:image/png;base64,abc',
    });

    expect(result['sig-1']).toBe('data:image/png;base64,abc');
    expect(result['sig-2']).toBe('data:image/png;base64,abc');
    expect(result['sig-3']).toBe('data:image/png;base64,abc');
    expect(result['initial-1']).toBeUndefined();
  });

  it('does not overwrite existing values', () => {
    const fields = [
      { id: 'sig-1', type: 'signature', recipient_id: 'rec_investor' },
      { id: 'sig-2', type: 'signature', recipient_id: 'rec_investor' },
    ];

    const result = replicateRecipientSignatureFieldValues(fields, {
      'sig-1': 'data:image/png;base64,first',
      'sig-2': 'data:image/png;base64,existing',
    });

    expect(result['sig-2']).toBe('data:image/png;base64,existing');
  });

  it('does not copy the investor signature onto a spouse signature field', () => {
    const fields = [
      { id: 'sig-1', type: 'signature', recipient_id: 'rec_investor', label: 'Signature' },
      { id: 'sig-2', type: 'signature', recipient_id: 'rec_investor', label: 'Signature' },
      {
        id: 'spouse-1',
        type: 'signature',
        recipient_id: 'rec_investor',
        label: 'Spouse Signature',
      },
    ];

    const result = replicateRecipientSignatureFieldValues(fields, {
      'sig-1': 'data:image/png;base64,investor',
    });

    expect(result['sig-2']).toBe('data:image/png;base64,investor');
    expect(result['spouse-1']).toBeUndefined();
  });

  it('does not copy a spouse signature onto investor signature fields', () => {
    const fields = [
      { id: 'sig-1', type: 'signature', recipient_id: 'rec_investor', label: 'Signature' },
      {
        id: 'spouse-1',
        type: 'signature',
        recipient_id: 'rec_investor',
        label: 'Spouse Signature',
      },
    ];

    const result = replicateRecipientSignatureFieldValues(fields, {
      'spouse-1': 'data:image/png;base64,spouse',
    });

    expect(result['sig-1']).toBeUndefined();
    expect(result['spouse-1']).toBe('data:image/png;base64,spouse');
  });
});
