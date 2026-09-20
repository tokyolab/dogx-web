<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DepartmentApi } from '#/api/system/department';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NButton, NPopconfirm, NSpace, NSwitch } from 'naive-ui';

import { message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDepartmentApi,
  listDepartmentsApi,
  updateDepartmentStatusApi,
} from '#/api/system/department';

import DepartmentFormModal from './department-form-modal.vue';
import { filterDepartmentTree } from './department-tree';

const items = ref<DepartmentApi.Item[]>([]);
const pending = ref<{ action: 'delete' | 'status'; id: number }>();
const loaded = ref(false);
let filtered = false;
let expandedIDs = new Set<number>();
const t = (key: string) => $t(`page.system.department.${key}`);
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: DepartmentFormModal,
});
const gridOptions: VxeTableGridOptions<DepartmentApi.Item> = {
  columns: [
    {
      field: 'name',
      title: t('name'),
      minWidth: 200,
      treeNode: true,
      align: 'left',
    },
    { field: 'sort', title: t('sort'), width: 80 },
    { field: 'remark', title: t('remark'), minWidth: 240, align: 'left' },
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
        const result = await listDepartmentsApi();
        items.value = result.items;
        loaded.value = true;
        const keyword = String(values.keyword ?? '').trim();
        const status =
          typeof values.status === 'number' ? values.status : undefined;
        filtered = !!keyword || status !== undefined;
        return { items: filterDepartmentTree(items.value, keyword, status) };
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
const [Grid, gridApi] = useVbenVxeGrid<DepartmentApi.Item>({
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
function openForm(record?: DepartmentApi.Item, parent?: DepartmentApi.Item) {
  formModalApi
    .setData({
      id: record?.id,
      items: items.value,
      parentId: parent?.id ?? 0,
      onSuccess: () => gridApi.query(),
    })
    .open();
}
function confirmMutation(action: 'delete' | 'status', row: DepartmentApi.Item) {
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
    await (deleting
      ? deleteDepartmentApi(id)
      : updateDepartmentStatusApi(id, status));
    let successKey = 'common.deleteSuccess';
    if (!deleting)
      successKey =
        status === 1 ? 'common.enableSuccess' : 'common.disableSuccess';
    message.success($t(successKey));
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
                ? 'page.system.department.disableConfirm'
                : 'page.system.department.enableConfirm',
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
            {{ $t('page.system.department.deleteConfirm', { name: row.name }) }}
          </NPopconfirm>
        </NSpace>
      </template>
    </Grid>
  </Page>
</template>
