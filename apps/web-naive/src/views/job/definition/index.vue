<script setup lang="ts">
import type { DropdownOption } from 'naive-ui';

import type { VNode } from 'vue';

import type { TriggerOperation } from './trigger-operation';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { JobDefinitionApi } from '#/api/job/definition';

import { h, markRaw, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { ChevronDown } from '@vben/icons';
import { $t } from '@vben/locales';
import { formatDateTime } from '@vben/utils';

import {
  NButton,
  NDropdown,
  NPopconfirm,
  NSpace,
  NSwitch,
  NTag,
  NTooltip,
} from 'naive-ui';

import { dialog, message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteJobDefinitionApi,
  listJobDefinitionsApi,
  triggerJobDefinitionApi,
  updateJobDefinitionStatusApi,
} from '#/api/job/definition';
import { createGroupOptionLoader } from '#/api/job/group';

import GroupSelect from '../group/group-select.vue';
import JobDetailModal from './job-detail-modal.vue';
import JobFormModal from './job-form-modal.vue';
import TriggerModal from './trigger-modal.vue';
import { createTriggerOperation } from './trigger-operation';

defineOptions({ name: 'JobManagement' });

const router = useRouter();
const loadGroups = createGroupOptionLoader();
const changingStatus = ref<number>();
const removing = ref<number>();
// Closing an uncertain submission must not turn the next click into a new run.
const operations = new Map<number, TriggerOperation>();
const [FormModal, formApi] = useVbenModal({ connectedComponent: JobFormModal });
const [DetailModal, detailApi] = useVbenModal({
  connectedComponent: JobDetailModal,
});
const [ExecuteModal, executeApi] = useVbenModal({
  connectedComponent: TriggerModal,
});
const gridOptions: VxeTableGridOptions<JobDefinitionApi.Item> = {
  height: 'auto',
  pagerConfig: { pageSizes: [10, 20, 50, 100, 200] },
  rowConfig: { keyField: 'id' },
  toolbarConfig: { search: true },
  columns: [
    { field: 'id', title: 'ID', minWidth: 100 },
    { field: 'name', title: $t('job-management.name'), minWidth: 180 },
    {
      field: 'executorGroupName',
      title: $t('job-management.executorGroupId'),
      minWidth: 160,
      formatter: ({ row }) => row.executorGroupName ?? '—',
    },
    {
      field: 'processorName',
      title: $t('job-management.processorName'),
      minWidth: 180,
    },
    {
      field: 'executionMode',
      title: $t('job-management.executionMode'),
      width: 120,
      slots: { default: 'mode' },
    },
    {
      field: 'status',
      title: $t('job-management.status'),
      width: 100,
      slots: { default: 'status' },
    },
    { field: 'cronExpr', title: $t('job-management.cronExpr'), minWidth: 160 },
    {
      field: 'nextTriggerAt',
      title: $t('job-management.nextTriggerAt'),
      minWidth: 180,
      formatter: ({ row }) =>
        row.nextTriggerAt ? formatDateTime(row.nextTriggerAt) : '—',
    },
    {
      field: 'createdAt',
      title: $t('job-management.createdAt'),
      minWidth: 180,
      formatter: 'formatDateTime',
    },
    {
      field: 'operation',
      title: $t('job-management.actions'),
      width: 300,
      fixed: 'right',
      slots: { default: 'operation' },
    },
  ],
  proxyConfig: {
    ajax: {
      query: ({ page }, values) =>
        listJobDefinitionsApi({
          page: page.currentPage,
          pageSize: page.pageSize,
          id: positiveID(values.id),
          name: String(values.name ?? '').trim(),
          executorGroupId: positiveID(values.executorGroupId),
          status:
            values.status === 0 || values.status === 1
              ? values.status
              : undefined,
        }),
    },
  },
};
const [Grid, gridApi] = useVbenVxeGrid<JobDefinitionApi.Item>({
  gridOptions,
  formOptions: {
    schema: [
      {
        component: 'InputNumber',
        fieldName: 'id',
        label: 'ID',
        componentProps: {
          min: 1,
          max: Number.MAX_SAFE_INTEGER,
          precision: 0,
          clearable: true,
          placeholder: $t('job-management.idSearch'),
        },
      },
      {
        component: 'Input',
        fieldName: 'name',
        label: $t('job-management.name'),
        componentProps: {
          maxlength: 128,
          clearable: true,
          placeholder: $t('job-management.nameSearch'),
        },
      },
      {
        component: markRaw(GroupSelect),
        fieldName: 'executorGroupId',
        label: $t('job-management.executorGroupId'),
        componentProps: { loader: loadGroups, placeholder: $t('common.all') },
      },
      {
        component: 'Select',
        fieldName: 'status',
        label: $t('job-management.status'),
        componentProps: {
          clearable: true,
          placeholder: $t('common.all'),
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
function positiveID(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}
function openForm(id?: number) {
  formApi.setData({ id, loadGroups, onSuccess: () => gridApi.reload() }).open();
}
function history(id: number) {
  return router.push({ name: 'JobExecutions', query: { jobId: id } });
}
function newOperation(id: number) {
  const operation = createTriggerOperation(id, triggerJobDefinitionApi);
  operations.set(id, operation);
  return operation;
}
function execute(row: JobDefinitionApi.Item) {
  const operation = operations.get(row.id) ?? newOperation(row.id);
  executeApi
    .setData({
      name: row.name,
      operation,
      newOperation: () => newOperation(row.id),
      onHistory: () => history(row.id),
      onSuccess: (instanceId: number) => {
        operations.delete(row.id);
        return router.push({ name: 'JobExecutions', query: { instanceId } });
      },
    })
    .open();
}
function moreOptions(row: JobDefinitionApi.Item): DropdownOption[] {
  const deleteDisabled =
    row.status !== 0 ||
    removing.value !== undefined ||
    changingStatus.value === row.id;
  return [
    { key: 'history', label: $t('job-management.history') },
    {
      key: 'delete',
      disabled: deleteDisabled,
      label: () =>
        h(
          'span',
          {
            class: deleteDisabled ? undefined : 'text-destructive',
          },
          $t('common.delete'),
        ),
    },
  ];
}
function renderMoreOption(
  row: JobDefinitionApi.Item,
  { node, option }: { node: VNode; option: DropdownOption },
) {
  if (option.key !== 'delete' || row.status === 0) return node;
  return h(
    NTooltip,
    { placement: 'left' },
    {
      default: () => $t('job-management.disableBeforeDelete'),
      trigger: () => node,
    },
  );
}
function onMore(key: number | string, row: JobDefinitionApi.Item) {
  if (key === 'history') {
    void history(row.id);
    return;
  }
  if (
    key !== 'delete' ||
    row.status !== 0 ||
    removing.value !== undefined ||
    changingStatus.value === row.id
  )
    return;
  dialog.warning({
    title: $t('common.delete'),
    content: $t('job-management.deleteConfirm', { name: row.name }),
    positiveText: $t('common.delete'),
    negativeText: $t('common.cancel'),
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => {
      if (removing.value !== undefined || changingStatus.value === row.id)
        return false;
      void remove(row.id).catch(() => undefined);
      return true;
    },
  });
}
async function remove(id: number) {
  removing.value = id;
  try {
    await deleteJobDefinitionApi(id);
    operations.delete(id);
    message.success($t('common.deleteSuccess'));
    await gridApi.reload();
  } finally {
    removing.value = undefined;
  }
}
function confirmStatus(row: JobDefinitionApi.Item) {
  if (changingStatus.value !== undefined || removing.value === row.id)
    return false;
  void changeStatus(row).catch(() => undefined);
  return true;
}
async function changeStatus(row: JobDefinitionApi.Item) {
  const status = row.status === 1 ? 0 : 1;
  changingStatus.value = row.id;
  try {
    await updateJobDefinitionStatusApi(row.id, status);
    message.success(
      $t(status === 1 ? 'common.enableSuccess' : 'common.disableSuccess'),
    );
    await gridApi.reload();
  } finally {
    changingStatus.value = undefined;
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormModal /><DetailModal /><ExecuteModal />
    <Grid>
      <template #toolbar-actions>
        <NButton type="primary" @click="openForm()">
          {{ $t('job-management.create') }}
        </NButton>
      </template>
      <template #mode="{ row }">
        <NTag
          :bordered="false"
          :type="row.executionMode === 2 ? 'info' : 'default'"
        >
          {{
            $t(
              row.executionMode === 2
                ? 'job-management.sharded'
                : 'job-management.ordinary',
            )
          }}
        </NTag>
      </template>
      <template #status="{ row }">
        <NPopconfirm
          :disabled="changingStatus !== undefined || removing === row.id"
          :positive-text="$t('common.confirm')"
          :negative-text="$t('common.cancel')"
          @positive-click="confirmStatus(row)"
        >
          <template #trigger>
            <NSwitch
              :value="row.status === 1"
              :loading="changingStatus === row.id"
              :disabled="changingStatus !== undefined || removing === row.id"
            />
          </template>
          {{
            $t(
              row.status === 1
                ? 'job-management.disableConfirm'
                : 'job-management.enableConfirm',
              { name: row.name },
            )
          }}
        </NPopconfirm>
      </template>
      <template #operation="{ row }">
        <NSpace :size="4" :wrap="false" justify="center">
          <NButton
            quaternary
            size="small"
            type="primary"
            @click="detailApi.setData({ id: row.id }).open()"
          >
            {{ $t('job-management.detail') }}
          </NButton>
          <NTooltip :disabled="row.status === 0">
            <template #trigger>
              <span>
                <NButton
                  quaternary
                  size="small"
                  type="primary"
                  :disabled="
                    row.status !== 0 ||
                    removing === row.id ||
                    changingStatus === row.id
                  "
                  @click="openForm(row.id)"
                >
                  {{ $t('common.edit') }}
                </NButton>
              </span>
            </template>
            {{ $t('job-management.disableBeforeEdit') }}
          </NTooltip>
          <NButton
            quaternary
            size="small"
            type="primary"
            :disabled="removing === row.id"
            @click="execute(row)"
          >
            {{ $t('job-management.execute') }}
          </NButton>
          <NDropdown
            :options="moreOptions(row)"
            :render-option="(info) => renderMoreOption(row, info)"
            trigger="click"
            @select="(key) => onMore(key, row)"
          >
            <NButton
              quaternary
              size="small"
              type="primary"
              :loading="removing === row.id"
            >
              {{ $t('job-management.more') }}
              <ChevronDown class="ml-1 size-3" />
            </NButton>
          </NDropdown>
        </NSpace>
      </template>
    </Grid>
  </Page>
</template>
