<script lang="ts" setup>
import type { TreeOption } from 'naive-ui';

import type { APITreeOption } from './api-permission';

import type { RoleApi } from '#/api/system';

import { computed, h, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import {
  NCheckbox,
  NEmpty,
  NInput,
  NSpace,
  NTag,
  NText,
  NTree,
} from 'naive-ui';

import { dialog, message } from '#/adapter/naive';
import {
  getRoleAPIsApi,
  listAPIsApi,
  SUPER_ADMIN_ROLE_CODE,
  updateRoleAPIsApi,
} from '#/api/system';

import {
  buildAPIResourceTree,
  filterAPIResourceTreeBySelection,
  getRequiredAPIIDs,
  normalizeAPISelection,
} from './api-permission';

interface APIPermissionModalData {
  record: RoleApi.RoleItem;
}

const currentRole = ref<RoleApi.RoleItem>();
const resources = ref<RoleApi.APIItem[]>([]);
const resourceTree = ref<APITreeOption[]>([]);
const checkedKeys = ref<Array<number | string>>([]);
const initialAPIIDs = ref<number[]>([]);
const keyword = ref('');
const onlySelected = ref(false);

const requiredAPIIDs = computed(() => getRequiredAPIIDs(resources.value));
const enabledAPIIDSet = computed(
  () =>
    new Set(
      resources.value
        .filter((item) => item.status === 1)
        .map((item) => item.id),
    ),
);
const selectedAPIIDs = computed(() =>
  normalizeAPISelection(checkedKeys.value, requiredAPIIDs.value).filter((id) =>
    enabledAPIIDSet.value.has(id),
  ),
);
const displayedTree = computed(() =>
  onlySelected.value
    ? filterAPIResourceTreeBySelection(
        resourceTree.value,
        new Set(selectedAPIIDs.value),
      )
    : resourceTree.value,
);
const optionalSelectedCount = computed(
  () => selectedAPIIDs.value.length - requiredAPIIDs.value.length,
);
const optionalAPICount = computed(
  () => enabledAPIIDSet.value.size - requiredAPIIDs.value.length,
);

function selectionsEqual(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

async function confirmDiscardChanges() {
  if (selectionsEqual(selectedAPIIDs.value, initialAPIIDs.value)) return true;

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    dialog.warning({
      content: $t('page.system.role.discardPermissionContent'),
      maskClosable: false,
      negativeText: $t('common.cancel'),
      onClose: () => finish(false),
      onNegativeClick: () => finish(false),
      onPositiveClick: () => finish(true),
      positiveText: $t('page.system.role.discardChanges'),
      title: $t('page.system.role.discardChangesTitle'),
    });
  });
}

function renderTreeLabel({ option }: { option: TreeOption }) {
  const node = option as APITreeOption;
  if (node.kind !== 'api' || !node.api) {
    return h(
      NText,
      { strong: node.kind === 'service' },
      { default: () => node.label },
    );
  }

  const api = node.api;
  return h(
    'div',
    {
      class: 'flex min-w-0 flex-1 items-center gap-2 pr-2',
      title: `${api.name} · ${api.method} ${api.path}`,
    },
    [
      h(
        'span',
        {
          class:
            'w-10 shrink-0 text-center font-mono text-xs text-muted-foreground',
        },
        api.method,
      ),
      h('span', { class: 'min-w-0 truncate' }, api.name),
      api.isRequired
        ? h(
            NTag,
            { bordered: false, size: 'small', type: 'info' },
            { default: () => $t('page.system.role.requiredAPI') },
          )
        : null,
    ],
  );
}

function handleCheckedKeys(keys: Array<number | string>) {
  checkedKeys.value = normalizeAPISelection(keys, requiredAPIIDs.value);
}

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onBeforeClose: confirmDiscardChanges,
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (!currentRole.value) return;

    modalApi.lock();
    try {
      await updateRoleAPIsApi(currentRole.value.id, selectedAPIIDs.value);
      initialAPIIDs.value = [...selectedAPIIDs.value];
      message.success($t('common.saveSuccess'));
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      currentRole.value = undefined;
      resources.value = [];
      resourceTree.value = [];
      checkedKeys.value = [];
      initialAPIIDs.value = [];
      keyword.value = '';
      onlySelected.value = false;
      return;
    }

    const record = modalApi.getData<APIPermissionModalData>()?.record;
    if (!record) {
      modalApi.close();
      return;
    }
    if (record.code === SUPER_ADMIN_ROLE_CODE) {
      modalApi.close();
      return;
    }

    currentRole.value = record;
    modalApi.setState({
      loading: true,
      title: `${$t('page.system.role.apiPermission')} · ${record.name}`,
    });
    try {
      const [apiResult, permissionResult] = await Promise.all([
        listAPIsApi(),
        getRoleAPIsApi(record.id),
      ]);
      resources.value = apiResult.items;
      resourceTree.value = buildAPIResourceTree(apiResult.items);

      const enabledIDs = new Set(
        apiResult.items
          .filter((item) => item.status === 1)
          .map((item) => item.id),
      );
      const selected = normalizeAPISelection(
        permissionResult.apiIds.filter((id) => enabledIDs.has(id)),
        getRequiredAPIIDs(apiResult.items),
      );
      checkedKeys.value = selected;
      initialAPIIDs.value = [...selected];
    } finally {
      modalApi.setState({ loading: false });
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
      :placeholder="$t('page.system.role.searchAPIPlaceholder')"
    />

    <div class="flex items-center justify-between text-xs">
      <NCheckbox v-model:checked="onlySelected">
        {{ $t('page.system.role.onlySelected') }}
      </NCheckbox>
      <NSpace :size="6">
        <NText depth="3">
          {{
            $t('page.system.role.selectedCount', {
              selected: optionalSelectedCount,
              total: optionalAPICount,
            })
          }}
        </NText>
        <NTag v-if="requiredAPIIDs.length > 0" :bordered="false" size="small">
          {{
            $t('page.system.role.requiredCount', {
              count: requiredAPIIDs.length,
            })
          }}
        </NTag>
      </NSpace>
    </div>

    <div class="h-105 min-h-0 rounded-md border border-border p-2">
      <NTree
        v-if="displayedTree.length > 0"
        block-line
        class="h-full"
        cascade
        check-on-click
        check-strategy="child"
        checkable
        default-expand-all
        :checked-keys="checkedKeys"
        :data="displayedTree"
        :pattern="keyword"
        :render-label="renderTreeLabel"
        :show-irrelevant-nodes="false"
        virtual-scroll
        @update:checked-keys="handleCheckedKeys"
      />
      <NEmpty
        v-else
        class="h-full justify-center"
        :description="$t('page.system.role.noAPIs')"
      />
    </div>
  </Modal>
</template>
