<script setup lang="ts">
import type { UserApi } from '#/api/system';

import { computed } from 'vue';

import { $t } from '@vben/locales';

import { NEllipsis, NPopover, NTag } from 'naive-ui';

const props = defineProps<{ roles: UserApi.UserRole[] }>();
const firstRole = computed(() => props.roles[0]);

function roleLabel(role: UserApi.UserRole) {
  return role.status === 1
    ? role.name
    : `${role.name} (${$t('common.disabled')})`;
}
</script>

<template>
  <div
    v-if="firstRole"
    class="flex w-full min-w-0 items-center justify-center gap-1"
  >
    <NTag
      :bordered="false"
      class="min-w-0 [&_.n-tag__content]:min-w-0"
      :type="firstRole.status === 1 ? 'info' : 'default'"
      size="small"
    >
      <NEllipsis class="max-w-full align-middle">
        {{ roleLabel(firstRole) }}
      </NEllipsis>
    </NTag>
    <NPopover
      v-if="roles.length > 1"
      placement="top"
      :style="{ maxWidth: 'min(360px, calc(100vw - 32px))' }"
      trigger="hover"
    >
      <template #trigger>
        <NTag :bordered="false" class="shrink-0" size="small">
          +{{ roles.length - 1 }}
        </NTag>
      </template>
      <ul
        :aria-label="$t('page.system.user.roles')"
        class="m-0 max-h-64 list-none space-y-1 overflow-y-auto p-0"
      >
        <li v-for="role in roles" :key="role.id">
          <NTag
            :bordered="false"
            :type="role.status === 1 ? 'info' : 'default'"
            size="small"
            :style="{ height: 'auto', maxWidth: '100%' }"
          >
            <span class="whitespace-normal break-all leading-5">
              {{ roleLabel(role) }}
            </span>
          </NTag>
        </li>
      </ul>
    </NPopover>
  </div>
</template>
