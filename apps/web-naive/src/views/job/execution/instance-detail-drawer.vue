<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { JobExecutionApi } from '#/api/job/execution';

import {
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue';

import { useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useDocumentVisibility } from '@vueuse/core';
import {
  NAlert,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NSpace,
  NTag,
} from 'naive-ui';

import { dialog, message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getInstanceApi,
  listInstanceTasksApi,
  stopInstanceApi,
} from '#/api/job/execution';

import { createDetailRefresh } from './detail-refresh';
import {
  endReasonLabel,
  instanceIsTerminal,
  instanceStatusLabel,
  instanceStatusType,
  taskStatusLabel,
  taskStatusType,
  taskTypeLabel,
  timeLabel,
  triggerLabel,
} from './presentation';
import TaskDetailModal from './task-detail-modal.vue';

interface DrawerData {
  id: number;
  onChanged?: () => unknown;
}

interface Query {
  id: number;
  page: number;
  pageSize: number;
}

interface DetailResult {
  instance: JobExecutionApi.InstanceDetail;
  tasks: JobExecutionApi.Page<JobExecutionApi.TaskItem>;
}

const instance = ref<JobExecutionApi.InstanceDetail>();
const currentID = ref<number>();
const opened = ref(false);
const active = ref(true);
const paused = ref(false);
const loading = ref(false);
const failed = ref(false);
const stopping = ref(false);
const visibility = useDocumentVisibility();
const page = ref(1);
const pageSize = ref(20);
const taskModalRef = ref<unknown>();
let openingTask = 0;
let stopGeneration = 0;

const [TaskModal, taskModalApi] = useVbenModal({
  connectedComponent: TaskDetailModal,
});

const taskGridOptions: VxeTableGridOptions<JobExecutionApi.TaskItem> = {
  columns: [
    { field: 'id', minWidth: 100, title: $t('job-execution.taskId') },
    {
      field: 'taskType',
      formatter: ({ row }) => taskTypeLabel(row.taskType),
      minWidth: 100,
      title: $t('job-execution.type'),
    },
    {
      field: 'status',
      minWidth: 120,
      slots: { default: 'status' },
      title: $t('job-execution.statusLabel'),
    },
    { field: 'attemptNo', minWidth: 100, title: $t('job-execution.attemptNo') },
    {
      field: 'usedAttempts',
      minWidth: 110,
      title: $t('job-execution.usedAttempts'),
    },
    {
      field: 'executorAddress',
      minWidth: 180,
      title: $t('job-execution.executorAddress'),
    },
    {
      field: 'endReason',
      formatter: ({ row }) => endReasonLabel(row.endReason),
      minWidth: 150,
      title: $t('job-execution.endReason'),
    },
    {
      field: 'nextDispatchAt',
      formatter: ({ row }) => timeLabel(row.nextDispatchAt),
      minWidth: 170,
      title: $t('job-execution.nextDispatchAt'),
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: $t('job-execution.operation'),
      width: 90,
    },
  ],
  data: [],
  minHeight: 240,
  pagerConfig: {
    currentPage: 1,
    pageSize: 20,
    pageSizes: [10, 20, 50, 100],
    total: 0,
  },
  proxyConfig: { enabled: false },
  rowConfig: { keyField: 'id' },
  toolbarConfig: { enabled: false },
};

const [TaskGrid, taskGridApi] = useVbenVxeGrid<JobExecutionApi.TaskItem>({
  gridEvents: {
    pageChange(event: { currentPage: number; pageSize: number }) {
      page.value = event.currentPage;
      pageSize.value = event.pageSize;
      selectPage();
    },
  },
  gridOptions: taskGridOptions,
});

const refresh = createDetailRefresh<Query, DetailResult>({
  apply(result, query) {
    instance.value = result.instance;
    failed.value = false;
    taskGridApi.setGridOptions({
      data: result.tasks.items,
      pagerConfig: {
        currentPage: query.page,
        pageSize: query.pageSize,
        total: result.tasks.total,
      },
    });
  },
  async load(query) {
    const detail = await getInstanceApi(query.id);
    const tasks = await listInstanceTasksApi({
      instanceId: query.id,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { instance: detail, tasks };
  },
  onError: () => (failed.value = true),
  onLoading(value) {
    loading.value = value;
    taskGridApi.setLoading(value);
  },
  shouldRefresh: (result) => !instanceIsTerminal(result.instance.status),
});

watch(
  [opened, active, visibility],
  () =>
    refresh.setEnabled(
      opened.value && active.value && visibility.value === 'visible',
    ),
  { immediate: true },
);
watch(paused, (value) => refresh.setPaused(value));
onActivated(() => (active.value = true));
onDeactivated(() => (active.value = false));
onBeforeUnmount(() => {
  refresh.dispose();
  stopGeneration++;
  openingTask++;
});

const [Drawer, drawerApi] = useVbenDrawer({
  class: 'w-[1100px] max-w-[96vw]',
  footer: false,
  onOpenChange(open) {
    opened.value = open;
    stopGeneration++;
    void closeTaskForInstance(++openingTask);
    instance.value = undefined;
    currentID.value = open ? drawerApi.getData<DrawerData>().id : undefined;
    failed.value = false;
    stopping.value = false;
    paused.value = false;
    page.value = 1;
    pageSize.value = 20;
    taskGridApi.setGridOptions({
      data: [],
      pagerConfig: { currentPage: 1, pageSize: 20, total: 0 },
    });
    drawerApi.setState({ title: $t('job-execution.instanceDetail') });
    selectPage();
  },
});

async function closeTaskForInstance(token: number) {
  // The drawer mounts its slot lazily. A superseded transition must not close
  // a newer Task dialog; an unmounted dialog has no open state to reset.
  await nextTick();
  if (token !== openingTask || !taskModalRef.value) return;
  await taskModalApi.close();
}

function selectPage() {
  refresh.select(
    currentID.value === undefined
      ? undefined
      : { id: currentID.value, page: page.value, pageSize: pageSize.value },
  );
}

async function openTask(id: number) {
  const token = ++openingTask;
  await taskModalApi.close();
  if (token === openingTask && opened.value)
    taskModalApi.setData({ id }).open();
}

function confirmStop() {
  const record = instance.value;
  if (!record || stopping.value || (record.status !== 1 && record.status !== 2))
    return;
  dialog.warning({
    content: $t('job-execution.stopConfirm', { id: record.id }),
    negativeText: $t('common.cancel'),
    onPositiveClick: () => requestStop(record.id),
    positiveButtonProps: { type: 'error' },
    positiveText: $t('job-execution.stop'),
    title: $t('job-execution.stop'),
  });
}

async function requestStop(id: number) {
  if (stopping.value || currentID.value !== id || !opened.value) return;
  const token = ++stopGeneration;
  stopping.value = true;
  try {
    const result = await stopInstanceApi(id);
    if (token !== stopGeneration || currentID.value !== id || !instance.value)
      return;
    instance.value = {
      ...instance.value,
      endReason: result.endReason,
      status: result.status,
    };
    if (result.status === 6) message.info($t('job-execution.stopRequested'));
    else if (result.status === 5) message.success($t('job-execution.stopped'));
    else
      message.info(
        $t('job-execution.stopState', {
          status: instanceStatusLabel(result.status),
        }),
      );
    // Invalidate a pre-stop read before refreshing committed state and this page.
    selectPage();
    await drawerApi.getData<DrawerData>().onChanged?.();
  } finally {
    if (token === stopGeneration) stopping.value = false;
  }
}

defineExpose(drawerApi);
</script>

<template>
  <Drawer>
    <TaskModal ref="taskModalRef" />
    <NSpace align="center" class="mb-4" justify="space-between">
      <span class="text-muted-foreground text-sm">{{
        $t('job-execution.refreshHelp')
      }}</span>
      <NSpace>
        <NButton
          v-if="instance && !instanceIsTerminal(instance.status)"
          size="small"
          @click="paused = !paused"
        >
          {{ $t(paused ? 'job-execution.resume' : 'job-execution.pause') }}
        </NButton>
        <NButton :loading="loading" size="small" @click="refresh.refresh()">
          {{ $t('job-execution.refresh') }}
        </NButton>
        <NButton
          v-if="instance && (instance.status === 1 || instance.status === 2)"
          :loading="stopping"
          size="small"
          type="error"
          @click="confirmStop"
        >
          {{ $t('job-execution.stop') }}
        </NButton>
      </NSpace>
    </NSpace>
    <NAlert v-if="failed" class="mb-4" type="error">
      {{ $t('job-execution.loadFailed') }}
    </NAlert>
    <template v-if="instance">
      <NDescriptions :column="2" bordered label-placement="left" size="small">
        <NDescriptionsItem :label="$t('job-execution.instanceId')">
          {{ instance.id }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.statusLabel')">
          <NTag
            :bordered="false"
            :type="instanceStatusType(instance.status)"
            size="small"
          >
            {{ instanceStatusLabel(instance.status) }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.jobId')">
          {{ instance.jobId }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.jobName')">
          {{ instance.jobName }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.executorGroupId')">
          {{ instance.executorGroupId }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.triggerType')">
          {{ triggerLabel(instance.triggerType) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.scheduledAt')">
          {{ timeLabel(instance.scheduledAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.createdAt')">
          {{ timeLabel(instance.createdAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.startedAt')">
          {{ timeLabel(instance.startedAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.deadlineAt')">
          {{ timeLabel(instance.deadlineAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.finishedAt')">
          {{ timeLabel(instance.finishedAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.updatedAt')">
          {{ timeLabel(instance.updatedAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.triggeredBy')">
          {{ instance.triggeredBy ?? '—' }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.requestId')">
          <span class="break-all">{{ instance.requestId ?? '—' }}</span>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.endReason')" :span="2">
          {{ endReasonLabel(instance.endReason) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.resultSummary')" :span="2">
          <pre
            class="max-h-48 overflow-auto whitespace-pre-wrap break-all font-sans"
            v-text="instance.resultSummary ?? '—'"
          ></pre>
        </NDescriptionsItem>
      </NDescriptions>
      <NAlert v-if="instance.status === 6" class="mt-3" type="warning">
        {{ $t('job-execution.stopRequested') }}
      </NAlert>
      <NDivider>{{ $t('job-execution.executionConfig') }}</NDivider>
      <NDescriptions :column="2" bordered label-placement="left" size="small">
        <NDescriptionsItem :label="$t('job-execution.processorName')">
          {{ instance.executionConfig.processorName }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.executionMode')">
          {{
            $t(
              instance.executionConfig.executionMode === 2
                ? 'job-execution.mode.sharded'
                : 'job-execution.mode.ordinary',
            )
          }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.postEnabled')">
          {{
            $t(
              instance.executionConfig.postEnabled
                ? 'job-execution.yes'
                : 'job-execution.no',
            )
          }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.maxRetries')">
          {{ instance.executionConfig.maxRetries }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.retryIntervalSeconds')">
          {{ instance.executionConfig.retryIntervalSeconds }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.timeoutSeconds')">
          {{ instance.executionConfig.timeoutSeconds }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.paramsOverridden')">
          {{
            $t(
              instance.paramsOverridden
                ? 'job-execution.yes'
                : 'job-execution.no',
            )
          }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.params')" :span="2">
          <pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all">{{
            instance.executionConfig.params
          }}</pre>
        </NDescriptionsItem>
      </NDescriptions>
      <template v-if="instance.shardStats !== null">
        <NDivider>{{ $t('job-execution.shardStats') }}</NDivider>
        <p class="text-muted-foreground mb-3 text-sm">
          {{ $t('job-execution.shardStatsHelp') }}
        </p>
        <NDescriptions :column="5" bordered label-placement="top" size="small">
          <NDescriptionsItem :label="$t('job-execution.total')">
            {{ instance.shardStats.total }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('job-execution.status.succeeded')">
            {{ instance.shardStats.succeeded }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('job-execution.status.failed')">
            {{ instance.shardStats.failed }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('job-execution.status.canceled')">
            {{ instance.shardStats.canceled }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('job-execution.unfinished')">
            {{ instance.shardStats.unfinished }}
          </NDescriptionsItem>
        </NDescriptions>
      </template>
    </template>
    <NDivider>{{ $t('job-execution.tasks') }}</NDivider>
    <TaskGrid>
      <template #status="{ row }">
        <NTag :bordered="false" :type="taskStatusType(row.status)" size="small">
          {{ taskStatusLabel(row.status) }}
        </NTag>
      </template>
      <template #operation="{ row }">
        <NButton
          quaternary
          size="small"
          type="primary"
          @click="openTask(row.id)"
        >
          {{ $t('job-execution.details') }}
        </NButton>
      </template>
    </TaskGrid>
  </Drawer>
</template>
