<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { JobExecutionApi } from '#/api/job/execution';

import {
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NButton, NTag } from 'naive-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listInstancesApi } from '#/api/job/execution';

import InstanceDetailDrawer from './instance-detail-drawer.vue';
import { createLatestQuery } from './latest-query';
import {
  endReasonLabel,
  instanceStatusLabel,
  instanceStatusType,
  positiveID,
  timeLabel,
  triggerLabel,
} from './presentation';

defineOptions({ name: 'JobExecutions' });

const route = useRoute();
const latestQuery =
  createLatestQuery<JobExecutionApi.Page<JobExecutionApi.InstanceItem>>();
let openGeneration = 0;
let routeGeneration = 0;
let inactive = false;

const [DetailDrawer, detailApi] = useVbenDrawer({
  connectedComponent: InstanceDetailDrawer,
});

const gridOptions: VxeTableGridOptions<JobExecutionApi.InstanceItem> = {
  columns: [
    { field: 'id', minWidth: 110, title: $t('job-execution.instanceId') },
    { field: 'jobId', minWidth: 100, title: $t('job-execution.jobId') },
    { field: 'jobName', minWidth: 180, title: $t('job-execution.jobName') },
    {
      field: 'executorGroupId',
      minWidth: 100,
      title: $t('job-execution.executorGroupId'),
    },
    {
      field: 'executorGroupName',
      formatter: ({ row }) => row.executorGroupName ?? '—',
      minWidth: 150,
      title: $t('job-execution.executorGroupName'),
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('job-execution.statusLabel'),
      width: 120,
    },
    {
      field: 'triggerType',
      formatter: ({ row }) => triggerLabel(row.triggerType),
      minWidth: 130,
      title: $t('job-execution.triggerType'),
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      minWidth: 180,
      title: $t('job-execution.createdAt'),
    },
    {
      field: 'startedAt',
      formatter: ({ row }) => timeLabel(row.startedAt),
      minWidth: 180,
      title: $t('job-execution.startedAt'),
    },
    {
      field: 'finishedAt',
      formatter: ({ row }) => timeLabel(row.finishedAt),
      minWidth: 180,
      title: $t('job-execution.finishedAt'),
    },
    {
      field: 'endReason',
      formatter: ({ row }) => endReasonLabel(row.endReason),
      minWidth: 160,
      title: $t('job-execution.endReason'),
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: $t('job-execution.operation'),
      width: 100,
    },
  ],
  height: 'auto',
  pagerConfig: { pageSizes: [10, 20, 50, 100, 200] },
  proxyConfig: {
    ajax: {
      query: ({ page }, values) =>
        latestQuery(() =>
          listInstancesApi({
            createdFrom: timestamp(values.createdFrom),
            createdTo: timestamp(values.createdTo),
            executorGroupId: positiveID(values.executorGroupId),
            id: positiveID(values.id),
            jobId: positiveID(values.jobId),
            jobName: String(values.jobName ?? '').trim(),
            page: page.currentPage,
            pageSize: page.pageSize,
            status: positiveID(values.status),
            triggerType: positiveID(values.triggerType),
          }),
        ),
    },
  },
  rowConfig: { keyField: 'id' },
  toolbarConfig: { search: true },
};

const [Grid, gridApi] = useVbenVxeGrid<JobExecutionApi.InstanceItem>({
  formOptions: {
    schema: [
      {
        component: 'InputNumber',
        componentProps: {
          clearable: true,
          min: 1,
          precision: 0,
          showButton: false,
        },
        fieldName: 'id',
        label: $t('job-execution.instanceId'),
      },
      {
        component: 'InputNumber',
        componentProps: {
          clearable: true,
          min: 1,
          precision: 0,
          showButton: false,
        },
        defaultValue: positiveID(route.query.jobId),
        fieldName: 'jobId',
        label: $t('job-execution.jobId'),
      },
      {
        component: 'Input',
        componentProps: {
          clearable: true,
          placeholder: $t('job-execution.jobNamePlaceholder'),
        },
        fieldName: 'jobName',
        label: $t('job-execution.jobName'),
      },
      {
        component: 'InputNumber',
        componentProps: {
          clearable: true,
          min: 1,
          precision: 0,
          showButton: false,
        },
        fieldName: 'executorGroupId',
        label: $t('job-execution.executorGroupId'),
      },
      {
        component: 'Select',
        componentProps: {
          clearable: true,
          options: [1, 2, 3, 4, 5, 6].map((value) => ({
            label: instanceStatusLabel(value),
            value,
          })),
          placeholder: $t('common.all'),
        },
        fieldName: 'status',
        label: $t('job-execution.statusLabel'),
      },
      {
        component: 'Select',
        componentProps: {
          clearable: true,
          options: [1, 2, 3].map((value) => ({
            label: triggerLabel(value),
            value,
          })),
          placeholder: $t('common.all'),
        },
        fieldName: 'triggerType',
        label: $t('job-execution.triggerType'),
      },
      {
        component: 'DatePicker',
        componentProps: { clearable: true, type: 'datetime' },
        fieldName: 'createdFrom',
        label: $t('job-execution.createdFrom'),
      },
      {
        component: 'DatePicker',
        componentProps: { clearable: true, type: 'datetime' },
        fieldName: 'createdTo',
        label: $t('job-execution.createdTo'),
      },
    ],
    showCollapseButton: false,
    submitOnEnter: true,
  },
  gridOptions,
});

function timestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toISOString()
    : undefined;
}

async function openInstance(id: number) {
  const token = ++openGeneration;
  await detailApi.close();
  if (token !== openGeneration || inactive) return;
  detailApi.setData({ id, onChanged: () => gridApi.query() }).open();
}

function openFromRoute() {
  const id = positiveID(route.query.instanceId);
  if (id !== undefined) void openInstance(id);
}

watch(
  () => route.query.jobId,
  async (value) => {
    const token = ++routeGeneration;
    await gridApi.formApi.setValues({ jobId: positiveID(value) ?? null });
    if (token === routeGeneration && !inactive) await gridApi.reload();
  },
);
watch(() => route.query.instanceId, openFromRoute);
onMounted(openFromRoute);
onActivated(() => {
  const returning = inactive;
  inactive = false;
  if (returning) openFromRoute();
});
onDeactivated(() => {
  inactive = true;
  openGeneration++;
  void detailApi.close();
});
onBeforeUnmount(() => {
  inactive = true;
  openGeneration++;
  routeGeneration++;
  void detailApi.close();
});
</script>

<template>
  <Page auto-content-height>
    <DetailDrawer />
    <Grid>
      <template #status="{ row }">
        <NTag
          :bordered="false"
          :type="instanceStatusType(row.status)"
          size="small"
        >
          {{ instanceStatusLabel(row.status) }}
        </NTag>
      </template>
      <template #operation="{ row }">
        <NButton
          quaternary
          size="small"
          type="primary"
          @click="openInstance(row.id)"
        >
          {{ $t('job-execution.details') }}
        </NButton>
      </template>
    </Grid>
  </Page>
</template>
