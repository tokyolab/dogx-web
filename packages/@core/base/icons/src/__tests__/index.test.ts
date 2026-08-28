import { describe, expect, it } from 'vitest';

import { addCollection, addIcon, listIcons } from '../index';

describe('offline icon registry', () => {
  it('lists locally registered collections by prefix without duplicates', () => {
    const collection = {
      prefix: 'dogx-test',
      width: 24,
      height: 24,
      icons: {
        first: { body: '<path />' },
        second: { body: '<circle />' },
      },
    };

    addCollection(collection);
    addCollection(collection);

    expect(listIcons('', 'dogx-test')).toEqual([
      'dogx-test:first',
      'dogx-test:second',
    ]);
  });

  it('tracks individually registered icons', () => {
    addIcon('dogx-single:sample', { body: '<path />' });

    expect(listIcons('', 'dogx-single')).toContain('dogx-single:sample');
    expect(listIcons('remote-provider', 'dogx-single')).toEqual([]);
  });
});
