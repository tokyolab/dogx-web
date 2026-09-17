<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MenuApi } from '#/api/system/menu';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NButton, NPopconfirm, NSpace, NSwitch, NTag } from 'naive-ui';

import { message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteMenuApi,
  listMenusApi,
  updateMenuStatusApi,
} from '#/api/system/menu';

import MenuFormModal from './menu-form-modal.vue';
import { filterMenuTree } from './menu-tree';

const items = ref<MenuApi.Item[]>([]);
const pending = ref<{ action: 'delete' | 'status'; id: number }>();
const loaded = ref(false);
let filtered = false;
let expandedIDs = new Set<number>();
const t = (key: string) => $t(`page.system.menu.${key}`);
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: MenuFormModal,
});
const gridOptions: VxeTableGridOptions<MenuApi.Item> = {
  columns: [
    {
      field: 'name',
      title: t('name'),
      minWidth: 200,
      treeNode: true,
      align: 'left',
    },
    { field: 'type', title: t('type'), width: 110, slots: { default: 'type' } },
    { field: 'path', title: t('path'), minWidth: 180, align: 'left' },
    { field: 'sort', title: t('sort'), width: 80 },
    {
      field: 'visible',
      title: t('visible'),
      width: 110,
      slots: { default: 'visible' },
    },
    {
      field: 'status',
      title: t('status'),
      width: 90,
      slots: { default: 'status' },
    },
    {
      field: 'operation',
      title: t('operation'),
      fixed: 'right',
      width: 250,
      slots: { default: 'operation' },
    },
  ],
  height: 'auto',
  pagerConfig: { enabled: false },
  rowConfig: { keyField: 'id' },
  treeConfig: {
    transform: true,
    rowField: 'id',
    parentField: 'parentId',
    reserve: true,
  },
  toolbarConfig: { search: true },
  proxyConfig: {
    ajax: {
      query: async (_params, values) => {
        expandedIDs = new Set(
          (gridApi.grid.getTreeExpandRecords?.() ?? []).map((row) => row.id),
        );
        const result = await listMenusApi();
        items.value = result.items;
        loaded.value = true;
        const keyword = String(values.keyword ?? '').trim();
        const status =
          typeof values.status === 'number' ? values.status : undefined;
        filtered = !!keyword || status !== undefined;
        return { items: filterMenuTree(items.value, keyword, status) };
      },
      querySuccess: async () => {
        await (filtered
          ? gridApi.grid.setAllTreeExpand(true)
          : gridApi.grid.setTreeExpand(
              items.value.filter((item) => expandedIDs.has(item.id)),
              true,
            ));
      },
    },
  },
};
const [Grid, gridApi] = useVbenVxeGrid<MenuApi.Item>({
  gridOptions,
  formOptions: {
    schema: [
      {
        component: 'Input',
        fieldName: 'keyword',
        label: t('name'),
        componentProps: {
          clearable: true,
          placeholder: t('keywordPlaceholder'),
        },
      },
      {
        component: 'Select',
        fieldName: 'status',
        label: t('status'),
        componentProps: {
          clearable: true,
          placeholder: $t('ui.placeholder.select'),
          options: [
            { label: $t('common.enabled'), value: 1 },
            { label: $t('common.disabled'), value: 0 },
          ],
        },
      },
    ],
    showCollapseButton: false,
    submitOnEnter: true,
  },
});
function openForm(record?: MenuApi.Item, parent?: MenuApi.Item) {
  let type = 1;
  if (parent) type = parent.type === 2 ? 3 : 2;
  formModalApi
    .setData({
      id: record?.id,
      items: items.value,
      parentId: parent?.id ?? 0,
      type,
      onSuccess: () => gridApi.query(),
    })
    .open();
}
function confirmMutation(action: 'delete' | 'status', row: MenuApi.Item) {
  if (pending.value !== undefined) return false;

  const nextStatus = row.status === 1 ? 0 : 1;
  pending.value = { action, id: row.id };
  // Guard synchronously, then close the confirmation before refreshing the row.
  // Returning a Promise here would keep it open while the status text changes.
  void mutate(row.id, action === 'delete', nextStatus).catch(() => undefined);
  return true;
}
async function mutate(id: number, deleting: boolean, status: number) {
  try {
    await (deleting ? deleteMenuApi(id) : updateMenuStatusApi(id, status));
    let successKey = 'deleteSuccess';
    if (!deleting)
      successKey = status === 1 ? 'enableSuccess' : 'disableSuccess';
    message.success(t(successKey));
    await gridApi.query();
  } finally {
    pending.value = undefined;
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormModal />
    <Grid>
      <template #toolbar-actions>
        <NSpace>
          <NButton :disabled="!loaded" type="primary" @click="openForm()">
            {{ t('createTitle') }}
          </NButton>
          <NButton @click="gridApi.grid.setAllTreeExpand(true)">
            {{ t('expand') }}
          </NButton>
          <NButton @click="gridApi.grid.clearTreeExpand()">
            {{ t('collapse') }}
          </NButton>
        </NSpace>
      </template>
      <template #type="{ row }">
        <NTag
          :bordered="false"
          :type="
            row.type === 1 ? 'default' : row.type === 2 ? 'info' : 'warning'
          "
          size="small"
        >
          {{
            t(
              row.type === 1
                ? 'directory'
                : row.type === 2
                  ? 'page'
                  : 'element',
            )
          }}
        </NTag>
      </template>
      <template #visible="{ row }">
        {{ row.type === 3 ? '' : t(row.visible ? 'shown' : 'hidden') }}
      </template>
      <template #status="{ row }">
        <NPopconfirm
          :disabled="pending !== undefined"
          :negative-text="$t('common.cancel')"
          :positive-text="$t('common.confirm')"
          @positive-click="confirmMutation('status', row)"
        >
          <template #trigger>
            <NSwitch
              :disabled="pending !== undefined"
              :loading="pending?.action === 'status' && pending.id === row.id"
              :value="row.status === 1"
            />
          </template>
          {{
            $t(
              row.status === 1
                ? 'page.system.menu.disableConfirm'
                : 'page.system.menu.enableConfirm',
              { name: row.name },
            )
          }}
        </NPopconfirm>
      </template>
      <template #operation="{ row }">
        <NSpace :size="4" justify="center" :wrap="false">
          <NButton
            :disabled="pending !== undefined"
            quaternary
            size="small"
            type="primary"
            @click="openForm(row)"
          >
            {{ $t('common.edit') }}
          </NButton>
          <NButton
            v-if="row.type !== 3"
            :disabled="pending !== undefined"
            quaternary
            size="small"
            type="primary"
            @click="openForm(undefined, row)"
          >
            {{ t('addChild') }}
          </NButton>
          <NPopconfirm
            :disabled="pending !== undefined"
            :negative-text="$t('common.cancel')"
            :positive-button-props="{ type: 'error' }"
            :positive-text="$t('common.delete')"
            @positive-click="confirmMutation('delete', row)"
          >
            <template #trigger>
              <NButton
                :disabled="pending !== undefined"
                :loading="pending?.action === 'delete' && pending.id === row.id"
                quaternary
                size="small"
                type="error"
              >
                {{ $t('common.delete') }}
              </NButton>
            </template>
            {{ $t('page.system.menu.deleteConfirm', { name: row.name }) }}
          </NPopconfirm>
        </NSpace>
      </template>
    </Grid>
  </Page>
</template>
