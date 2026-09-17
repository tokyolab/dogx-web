import type { App } from 'vue';

import type { RouteMeta } from '@vben/types';

import { createApp, defineComponent, h } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import Breadcrumb from './breadcrumb.vue';

const mocks = vi.hoisted(() => ({
  translate: vi.fn((key: string) => `translated:${key}`),
  props: vi.fn(),
  route: {
    meta: { title: 'page.current' } as RouteMeta,
    matched: [{ path: '/static', meta: { title: 'page.static' } }],
  },
}));
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@vben/locales', () => ({ $t: mocks.translate }));
vi.mock('@vben-core/shadcn-ui', () => ({
  VbenBreadcrumbView: defineComponent({
    props: { breadcrumbs: { type: Array, default: () => [] } },
    setup(props) {
      mocks.props(props.breadcrumbs);
      return () => h('div');
    },
  }),
}));

let app: App;
afterEach(() => {
  app?.unmount();
  vi.clearAllMocks();
});

describe('breadcrumb navigation titles', () => {
  it('uses database hierarchy and literal titles instead of flattened component matches', () => {
    mocks.route.meta.menuBreadcrumbs = [
      { path: '/system', title: '系统管理', icon: 'lucide:settings' },
      { path: '/system/user', title: 'page.system.user.title' },
    ];
    app = createApp(Breadcrumb);
    app.mount(document.createElement('div'));
    expect(mocks.props).toHaveBeenCalledWith([
      { path: '/system', title: '系统管理', icon: 'lucide:settings' },
      {
        path: '/system/user',
        title: 'page.system.user.title',
        icon: undefined,
      },
    ]);
    expect(mocks.translate).not.toHaveBeenCalled();
  });
  it('retains built-in route breadcrumbs and translations', () => {
    mocks.route.meta.menuBreadcrumbs = undefined;
    app = createApp(Breadcrumb);
    app.mount(document.createElement('div'));
    expect(mocks.props).toHaveBeenCalledWith([
      { path: '/static', title: 'translated:page.static', icon: undefined },
    ]);
  });
});
