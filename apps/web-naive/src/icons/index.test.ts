import { h, render } from 'vue';

import { IconifyIcon, listIcons } from '@vben/icons';

import lucideIcons from '@iconify-json/lucide/icons.json';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerLocalIcons } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('application offline icons', () => {
  it('makes the full Lucide collection available to the icon picker', () => {
    registerLocalIcons();

    expect(listIcons('', 'lucide').toSorted()).toEqual(
      Object.keys(lucideIcons.icons)
        .map((name) => `lucide:${name}`)
        .toSorted(),
    );
    expect(listIcons('', 'lucide')).toContain('lucide:menu');
  });

  it.each([
    'lucide:menu',
    'lucide:layout-dashboard',
    'lucide:area-chart',
    'lucide:user',
    'lucide:settings',
    'lucide:shield-check',
    'ep:fold',
    'ep:expand',
    'fluent-mdl2:world-clock',
    'mdi:keyboard-esc',
    'mdi:home-outline',
  ])('renders %s without fetching resources', (icon) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    registerLocalIcons();

    const container = document.createElement('div');
    try {
      render(h(IconifyIcon, { icon }), container);
      expect(container.querySelector('svg')).not.toBeNull();
      expect(container.querySelector('svg')?.innerHTML).not.toBe('');
    } finally {
      render(null, container);
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not duplicate picker entries when registered again', () => {
    registerLocalIcons();
    const icons = listIcons();
    registerLocalIcons();

    expect(listIcons()).toEqual(icons);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
