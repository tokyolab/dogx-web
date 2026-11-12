<script setup lang="ts">
import type { JobExecutionApi } from '#/api/job/execution';

import { onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
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

import { getTaskApi } from '#/api/job/execution';

import { createDetailRefresh } from './detail-refresh';
import {
  endReasonLabel,
  taskIsTerminal,
  taskStatusLabel,
  taskStatusType,
  taskTypeLabel,
  timeLabel,
} from './presentation';

const task = ref<JobExecutionApi.TaskItem>();
const currentID = ref<number>();
const opened = ref(false);
const active = ref(true);
const loading = ref(false);
const failed = ref(false);
const paused = ref(false);
const visibility = useDocumentVisibility();
const data = ref<null | string>();
const dataKind = ref<JobExecutionApi.DataKind>();
const dataLoading = ref(false);
const dataFailed = ref(false);
const dataLoadedAt = ref<string>();
let dataGeneration = 0;

const refresh = createDetailRefresh<number, JobExecutionApi.TaskDetail>({
  apply(result) {
    task.value = result.task;
    failed.value = false;
  },
  load: (id) => getTaskApi(id),
  onError: () => (failed.value = true),
  onLoading: (value) => (loading.value = value),
  shouldRefresh: (result) => !taskIsTerminal(result.task.status),
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
  dataGeneration++;
});

const [Modal, modalApi] = useVbenModal({
  class: 'w-[900px] max-w-[95vw]',
  footer: false,
  onOpenChange(open) {
    opened.value = open;
    dataGeneration++;
    task.value = undefined;
    data.value = undefined;
    dataKind.value = undefined;
    dataLoadedAt.value = undefined;
    dataLoading.value = false;
    dataFailed.value = false;
    failed.value = false;
    paused.value = false;
    currentID.value = open ? modalApi.getData<{ id: number }>().id : undefined;
    refresh.select(currentID.value);
    modalApi.setState({ title: $t('job-execution.taskDetail') });
  },
});

async function loadData(kind: JobExecutionApi.DataKind) {
  const id = currentID.value;
  if (id === undefined || dataLoading.value) return;
  const token = ++dataGeneration;
  dataLoading.value = true;
  dataKind.value = kind;
  data.value = undefined;
  dataLoadedAt.value = undefined;
  dataFailed.value = false;
  try {
    const result = await getTaskApi(id, kind);
    if (token !== dataGeneration || currentID.value !== id || !opened.value)
      return;
    // Keep the server's JSON text verbatim, including large integers and null.
    data.value = result.data;
    dataLoadedAt.value = new Date().toISOString();
  } catch {
    if (token === dataGeneration) dataFailed.value = true;
  } finally {
    if (token === dataGeneration) dataLoading.value = false;
  }
}

defineExpose(modalApi);
</script>

<template>
  <Modal>
    <NSpace align="center" class="mb-4" justify="space-between">
      <span class="text-muted-foreground text-sm">
        {{ $t('job-execution.taskRefreshHelp') }}
      </span>
      <NSpace>
        <NButton
          v-if="task && !taskIsTerminal(task.status)"
          size="small"
          @click="paused = !paused"
        >
          {{ $t(paused ? 'job-execution.resume' : 'job-execution.pause') }}
        </NButton>
        <NButton :loading="loading" size="small" @click="refresh.refresh()">
          {{ $t('job-execution.refresh') }}
        </NButton>
      </NSpace>
    </NSpace>
    <NAlert v-if="failed" class="mb-4" type="error">
      {{ $t('job-execution.loadFailed') }}
    </NAlert>
    <template v-if="task">
      <NDescriptions :column="2" bordered label-placement="left" size="small">
        <NDescriptionsItem :label="$t('job-execution.taskId')">
          {{ task.id }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.instanceId')">
          {{ task.instanceId }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.type')">
          {{ taskTypeLabel(task.taskType) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.statusLabel')">
          <NTag
            :bordered="false"
            :type="taskStatusType(task.status)"
            size="small"
          >
            {{ taskStatusLabel(task.status) }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.attemptNo')">
          {{ task.attemptNo }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.usedAttempts')">
          {{ task.usedAttempts }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.executorInstanceId')">
          <span class="break-all">{{ task.executorInstanceId ?? '—' }}</span>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.executorAddress')">
          <span class="break-all">{{ task.executorAddress ?? '—' }}</span>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.attemptRegisteredAt')">
          {{ timeLabel(task.attemptRegisteredAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.nextDispatchAt')">
          {{ timeLabel(task.nextDispatchAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.startedAt')">
          {{ timeLabel(task.startedAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.finishedAt')">
          {{ timeLabel(task.finishedAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.createdAt')">
          {{ timeLabel(task.createdAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.updatedAt')">
          {{ timeLabel(task.updatedAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.endReason')" :span="2">
          {{ endReasonLabel(task.endReason) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-execution.resultSummary')" :span="2">
          <pre
            class="max-h-48 overflow-auto whitespace-pre-wrap break-all font-sans"
            v-text="task.resultSummary ?? '—'"
          ></pre>
        </NDescriptionsItem>
      </NDescriptions>
      <NAlert v-if="!taskIsTerminal(task.status)" class="mt-4" type="info">
        {{ $t('job-execution.previousAttemptHelp') }}
      </NAlert>
      <NDivider>{{ $t('job-execution.businessData') }}</NDivider>
      <p class="text-muted-foreground mb-3 text-sm">
        {{ $t('job-execution.dataHelp') }}
      </p>
      <NSpace class="mb-3">
        <NButton
          :disabled="dataLoading"
          size="small"
          @click="loadData('input')"
        >
          {{ $t('job-execution.loadInput') }}
        </NButton>
        <NButton
          :disabled="dataLoading"
          size="small"
          @click="loadData('result')"
        >
          {{ $t('job-execution.loadResult') }}
        </NButton>
      </NSpace>
      <p v-if="dataLoading" role="status">
        {{ $t('job-execution.loadingData') }}
      </p>
      <NAlert v-else-if="dataFailed" type="error">
        {{ $t('job-execution.dataLoadFailed') }}
      </NAlert>
      <template v-else-if="data !== undefined">
        <p class="text-muted-foreground mb-2 text-sm">
          {{
            $t(
              dataKind === 'input'
                ? 'job-execution.inputData'
                : 'job-execution.resultData',
            )
          }}
          · {{ $t('job-execution.loadedAt') }}
          {{ timeLabel(dataLoadedAt ?? null) }}
        </p>
        <NAlert v-if="data === null" type="info">
          {{ $t('job-execution.dataAbsent') }}
        </NAlert>
        <pre
          v-else
          class="bg-muted max-h-96 overflow-auto rounded p-3 text-sm whitespace-pre-wrap break-all"
          v-text="data"
        ></pre>
      </template>
    </template>
  </Modal>
</template>
