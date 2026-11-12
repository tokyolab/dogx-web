<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ExecutorGroupApi } from '#/api/job/group';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NButton, NPopconfirm, NSpace } from 'naive-ui';

import { message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteExecutorGroupApi, listExecutorGroupsApi } from '#/api/job/group';

import GroupModal from './group-modal.vue';

defineOptions({ name: 'ExecutorGroups' });

const removing = ref<number>();
const [EditModal, modalApi] = useVbenModal({ connectedComponent: GroupModal });
const gridOptions: VxeTableGridOptions<ExecutorGroupApi.Item> = {
  height: 'auto',
  pagerConfig: { pageSizes: [10, 20, 50, 100, 200] },
  rowConfig: { keyField: 'id' },
  toolbarConfig: { search: true },
  columns: [
    { field: 'id', title: 'ID', width: 100 },
    { field: 'name', title: $t('job-group.name'), minWidth: 180 },
    {
      field: 'discoveryKey',
      title: $t('job-group.discoveryKey'),
      minWidth: 260,
    },
    {
      field: 'createdAt',
      title: $t('job-group.createdAt'),
      formatter: 'formatDateTime',
      minWidth: 180,
    },
    {
      field: 'operation',
      title: $t('job-group.actions'),
      width: 180,
      fixed: 'right',
      slots: { default: 'operation' },
    },
  ],
  proxyConfig: {
    ajax: {
      query: async ({ page }, values) =>
        listExecutorGroupsApi({
          page: page.currentPage,
          pageSize: page.pageSize,
          name: String(values.name ?? '').trim(),
        }),
    },
  },
};
const [Grid, gridApi] = useVbenVxeGrid<ExecutorGroupApi.Item>({
  gridOptions,
  formOptions: {
    schema: [
      {
        component: 'Input',
        fieldName: 'name',
        label: $t('job-group.name'),
        componentProps: {
          clearable: true,
          maxlength: 128,
          placeholder: $t('job-group.nameSearch'),
        },
      },
    ],
    showCollapseButton: false,
    submitOnEnter: true,
  },
});
function open(id?: number) {
  modalApi.setData({ id, onSuccess: () => gridApi.reload() }).open();
}
function confirmRemove(id: number) {
  if (removing.value !== undefined) return false;
  void remove(id).catch(() => undefined);
  return true;
}
async function remove(id: number) {
  if (removing.value !== undefined) return;
  removing.value = id;
  try {
    await deleteExecutorGroupApi(id);
    message.success($t('common.deleteSuccess'));
    await gridApi.reload();
  } finally {
    removing.value = undefined;
  }
}
</script>
<template>
  <Page auto-content-height>
    <EditModal />
    <Grid>
      <template #toolbar-actions>
        <NButton type="primary" @click="open()">
          {{ $t('job-group.create') }}
        </NButton>
      </template>
      <template #operation="{ row }">
        <NSpace :size="4" :wrap="false">
          <NButton quaternary size="small" type="primary" @click="open(row.id)">
            {{ $t('job-group.detail') }}
          </NButton>
          <NPopconfirm
            :disabled="removing !== undefined"
            :positive-text="$t('common.confirm')"
            :negative-text="$t('common.cancel')"
            @positive-click="confirmRemove(row.id)"
          >
            <template #trigger>
              <NButton
                quaternary
                size="small"
                type="error"
                :disabled="removing !== undefined"
                :loading="removing === row.id"
              >
                {{ $t('common.delete') }}
              </NButton>
            </template>
            {{ $t('job-group.deleteConfirm', { name: row.name }) }}
          </NPopconfirm>
        </NSpace>
      </template>
    </Grid>
  </Page>
</template>
