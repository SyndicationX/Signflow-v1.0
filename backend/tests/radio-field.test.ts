import { describe, expect, it } from 'vitest';
import { resolveRadioGroupIds } from '../src/utils/radio-field';

describe('resolveRadioGroupIds', () => {
  it('keeps a placed radio in its own group even when it sits beside another', () => {
    const groups = resolveRadioGroupIds([
      {
        id: 'a',
        type: 'radio',
        recipientId: 'buyer',
        page: 1,
        x: 10,
        y: 10,
        width: 4,
        height: 3,
        radioGroupId: 'rg_placed_a',
      },
      {
        id: 'b',
        type: 'radio',
        recipientId: 'buyer',
        page: 1,
        x: 11,
        y: 14,
        width: 4,
        height: 3,
        radioGroupId: 'rg_placed_b',
      },
    ]);

    expect(groups.get('a')).toBe('rg_placed_a');
    expect(groups.get('b')).toBe('rg_placed_b');
  });

  it('groups only radios that share the id copied by the plus button', () => {
    const groups = resolveRadioGroupIds([
      {
        id: 'a',
        type: 'radio',
        recipientId: 'buyer',
        page: 1,
        x: 10,
        y: 10,
        width: 4,
        height: 3,
        radioGroupId: 'rg_plus',
      },
      {
        id: 'b',
        type: 'radio',
        recipientId: 'buyer',
        page: 1,
        x: 70,
        y: 40,
        width: 4,
        height: 3,
        radioGroupId: 'rg_plus',
      },
    ]);

    expect(groups.get('a')).toBe('rg_plus');
    expect(groups.get('b')).toBe('rg_plus');
  });
});
