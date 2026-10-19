import { describe, expect, it } from 'vitest';
import { resolveRadioGroupIds } from '../src/utils/radio-field';
import {
  buildRadioGroupSelectionUpdates,
  restoreSavedRadioValues,
} from '../../frontend/src/utils/radioField';

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

function radio(id: string, radioGroupId: string, value?: string) {
  return {
    id,
    type: 'radio' as const,
    label: id,
    x: 0,
    y: 0,
    width: 4,
    height: 3,
    page: 1,
    recipientId: 'buyer',
    required: true,
    radioGroupId,
    value,
  };
}

describe('radio selection', () => {
  it('selects one option and clears only the other options in that group', () => {
    const fields = [
      radio('a1', 'rg_a'),
      radio('a2', 'rg_a'),
      radio('b1', 'rg_b', 'selected'),
    ];

    const updates = buildRadioGroupSelectionUpdates(fields, 'a2');

    expect(updates).toEqual({
      a1: '',
      a2: 'selected',
    });
    expect(updates.b1).toBeUndefined();
  });

  it('restores the saved option in each group and leaves unsaved groups alone', () => {
    const fields = [
      radio('a1', 'rg_a', 'selected'),
      radio('a2', 'rg_a', 'selected'),
      radio('b1', 'rg_b', 'selected'),
      radio('c1', 'rg_c'),
    ];

    expect(restoreSavedRadioValues(fields)).toEqual({
      a1: 'selected',
      a2: '',
      b1: 'selected',
    });
  });
});
