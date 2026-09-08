import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings',
      order: 10,
      title: $t('page.system.title'),
    },
    name: 'SystemManagement',
    path: '/system',
    children: [
      {
        component: () => import('#/views/system/user/index.vue'),
        meta: { icon: 'lucide:user', title: $t('page.system.user.title') },
        name: 'UserManagement',
        path: '/system/user',
      },
      {
        component: () => import('#/views/system/role/index.vue'),
        meta: {
          icon: 'lucide:shield-check',
          title: $t('page.system.role.title'),
        },
        name: 'RoleManagement',
        path: '/system/role',
      },
    ],
  },
];

export default routes;
