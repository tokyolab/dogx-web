<script setup lang="ts">
import type { TreeOption } from 'naive-ui';

import type { MenuPermissionNode } from './menu-permission';

import type { MenuApi, RoleApi } from '#/api/system';

import { computed, h, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NButton, NEmpty, NInput, NTag, NTree } from 'naive-ui';

import { dialog, message } from '#/adapter/naive';
import {
  getRoleMenusApi,
  SUPER_ADMIN_ROLE_CODE,
  updateRoleMenusApi,
} from '#/api/system';

import {
  buildMenuPermissionTree,
  menuCheckState,
  menuGrantIDs,
  updateMenuGrants,
} from './menu-permission';

const role = ref<RoleApi.RoleItem>();
const items = ref<MenuApi.Item[]>([]);
const selected = ref<number[]>([]);
const initial = ref<number[]>([]);
const keyword = ref('');
const ready = ref(false);
const saving = ref(false);
let generation = 0;
const tree = computed(() => buildMenuPermissionTree(items.value));
const checks = computed(() => menuCheckState(tree.value, selected.value));
const changed = computed(
  () => JSON.stringify(selected.value) !== JSON.stringify(initial.value),
);

function handleChecked(
  keys: Array<number | string>,
  _options: unknown,
  meta: { node: null | TreeOption },
) {
  if (!ready.value || saving.value || !meta.node) return;
  selected.value = updateMenuGrants(
    items.value,
    tree.value,
    selected.value,
    keys,
    Number(meta.node.key),
  );
}

function renderLabel({ option }: { option: TreeOption }) {
  const node = option as MenuPermissionNode;
  return h('div', { class: 'flex min-w-0 items-center gap-2 pr-2' }, [
    h('span', { class: 'truncate', title: node.label }, node.label),
    node.menu.status === 0
      ? h(
          NTag,
          { size: 'small', bordered: false },
          { default: () => $t('common.disabled') },
        )
      : null,
  ]);
}

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  async onBeforeClose() {
    if (saving.value) return false;
    if (!changed.value) return true;
    return await new Promise<boolean>((resolve) => {
      dialog.warning({
        title: $t('page.system.role.discardChangesTitle'),
        content: $t('page.system.role.discardMenuPermissionContent'),
        positiveText: $t('page.system.role.discardChanges'),
        negativeText: $t('common.cancel'),
        maskClosable: false,
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
      });
    });
  },
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (!ready.value || saving.value || !role.value) return;
    saving.value = true;
    modalApi.lock();
    try {
      await updateRoleMenusApi(role.value.id, selected.value);
      initial.value = [...selected.value];
      message.success($t('page.system.role.menuPermissionSaved'));
      saving.value = false;
      modalApi.close();
    } finally {
      saving.value = false;
      modalApi.unlock();
    }
  },
  async onOpenChange(open) {
    const current = ++generation;
    ready.value = false;
    items.value = [];
    selected.value = [];
    initial.value = [];
    keyword.value = '';
    role.value = undefined;
    if (!open) return;
    const record = modalApi.getData<{ record: RoleApi.RoleItem }>()?.record;
    if (
      !record ||
      record.code === SUPER_ADMIN_ROLE_CODE ||
      record.status !== 1
    ) {
      modalApi.close();
      return;
    }
    role.value = record;
    modalApi.setState({
      loading: true,
      confirmDisabled: true,
      title: `${$t('page.system.role.menuPermission')} · ${record.name}`,
    });
    try {
      const result = await getRoleMenusApi(record.id);
      if (current !== generation) return;
      items.value = result.items;
      selected.value = menuGrantIDs(result.items, result.menuIds);
      initial.value = [...selected.value];
      ready.value = true;
      modalApi.setState({ confirmDisabled: false });
    } finally {
      if (current === generation) modalApi.setState({ loading: false });
    }
  },
});
defineExpose(modalApi);
</script>

<template>
  <Modal content-class="flex min-h-0 flex-col gap-3">
    <NInput
      v-model:value="keyword"
      clearable
      :placeholder="$t('page.system.role.searchMenuPlaceholder')"
    />
    <div class="flex items-center justify-between">
      <div class="flex gap-2">
        <NButton
          size="small"
          :disabled="!ready || saving"
          @click="
            selected = menuGrantIDs(
              items,
              items.map((item) => item.id),
            )
          "
        >
          {{ $t('page.system.role.selectAllMenus') }}
        </NButton>
        <NButton
          size="small"
          :disabled="!ready || saving"
          @click="selected = []"
        >
          {{ $t('page.system.role.clearMenus') }}
        </NButton>
      </div>
      <span class="text-xs text-muted-foreground">{{
        $t('page.system.role.selectedCount', {
          selected: selected.length,
          total: items.length,
        })
      }}</span>
    </div>
    <div class="h-105 min-h-0 rounded-md border border-border p-2">
      <NTree
        v-if="tree.length > 0"
        block-line
        class="h-full"
        cascade
        check-on-click
        check-strategy="child"
        checkable
        default-expand-all
        :disabled="!ready || saving"
        :checked-keys="checks.checked"
        :indeterminate-keys="checks.indeterminate"
        :data="tree"
        :pattern="keyword"
        :render-label="renderLabel"
        :show-irrelevant-nodes="false"
        virtual-scroll
        @update:checked-keys="handleChecked"
      />
      <NEmpty
        v-else
        class="h-full justify-center"
        :description="$t('page.system.role.noMenus')"
      />
    </div>
    <p class="text-xs text-muted-foreground">
      {{ $t('page.system.role.menuPermissionHelp') }}
    </p>
  </Modal>
</template>
