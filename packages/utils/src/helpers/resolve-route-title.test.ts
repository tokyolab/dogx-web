import { describe, expect, it, vi } from 'vitest';

import { resolveRouteTitle } from './resolve-route-title';

describe('route titles', () => {
  it('never translates database text, even when it equals a translation key', () => {
    const translate = vi.fn(() => '系统管理');
    expect(
      resolveRouteTitle(
        { title: 'page.system.title', titleIsLiteral: true },
        translate,
      ),
    ).toBe('page.system.title');
    expect(translate).not.toHaveBeenCalled();
  });
  it('retains translation for built-in routes', () => {
    const translate = vi.fn(() => 'Analytics');
    expect(
      resolveRouteTitle({ title: 'page.dashboard.analytics' }, translate),
    ).toBe('Analytics');
    expect(translate).toHaveBeenCalledWith('page.dashboard.analytics');
    expect(resolveRouteTitle({ title: '' }, translate)).toBe('');
  });
});
