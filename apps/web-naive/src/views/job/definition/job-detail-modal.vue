<script setup lang="ts">
import type { JobDefinitionApi } from '#/api/job/definition';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { formatDateTime } from '@vben/utils';

import { NDescriptions, NDescriptionsItem, NTag } from 'naive-ui';

import { getJobDefinitionApi } from '#/api/job/definition';

const detail = ref<JobDefinitionApi.Detail>();
let generation = 0;
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  showConfirmButton: false,
  title: $t('job-management.detail'),
  onCancel() {
    modalApi.close();
  },
  async onOpenChange(open) {
    const token = ++generation;
    detail.value = undefined;
    if (!open) return;
    modalApi.setState({ loading: true });
    try {
      const response = await getJobDefinitionApi(
        modalApi.getData<{ id: number }>().id,
      );
      if (token === generation) detail.value = response;
    } catch {
      if (token === generation) modalApi.close();
    } finally {
      if (token === generation) modalApi.setState({ loading: false });
    }
  },
});
defineExpose(modalApi);
</script>

<template>
  <Modal class="w-[760px]">
    <NDescriptions v-if="detail" :column="1" bordered label-placement="left">
      <NDescriptionsItem label="ID">{{ detail.id }}</NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.name')">
        {{ detail.name }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.status')">
        <NTag
          :type="detail.status === 1 ? 'success' : 'default'"
          :bordered="false"
        >
          {{ $t(detail.status === 1 ? 'common.enabled' : 'common.disabled') }}
        </NTag>
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.executorGroupId')">
        {{ detail.executorGroupName ?? '—' }} (#{{ detail.executorGroupId }})
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.processorName')">
        <code>{{ detail.processorName }}</code>
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.executionMode')">
        {{
          $t(
            detail.executionMode === 2
              ? 'job-management.sharded'
              : 'job-management.ordinary',
          )
        }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.postEnabled')">
        {{ $t(detail.postEnabled ? 'common.enabled' : 'common.disabled') }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.cronExpr')">
        <code>{{ detail.cronExpr }}</code>
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.nextTriggerAt')">
        {{ detail.nextTriggerAt ? formatDateTime(detail.nextTriggerAt) : '—' }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.misfirePolicy')">
        {{
          $t(
            detail.misfirePolicy === 1
              ? 'job-management.misfireOnce'
              : 'job-management.misfireIgnore',
          )
        }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.blockPolicy')">
        {{
          $t(
            detail.blockPolicy === 1
              ? 'job-management.blockParallel'
              : 'job-management.blockDiscard',
          )
        }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.maxRetries')">
        {{ detail.maxRetries }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.retryIntervalSeconds')">
        {{ detail.retryIntervalSeconds }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.timeoutSeconds')">
        {{ detail.timeoutSeconds }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.params')">
        <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all">{{
          detail.params || '—'
        }}</pre>
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.remark')">
        <span class="whitespace-pre-wrap break-all">{{
          detail.remark || '—'
        }}</span>
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.createdAt')">
        {{ formatDateTime(detail.createdAt) }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="$t('job-management.updatedAt')">
        {{ formatDateTime(detail.updatedAt) }}
      </NDescriptionsItem>
    </NDescriptions>
  </Modal>
</template>
