<script setup lang="ts">
import type { TriggerOperation } from './trigger-operation';

import { computed, ref, shallowRef } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NAlert, NButton, NFormItem, NInput, NSpace, NSwitch } from 'naive-ui';

import { dialog, message } from '#/adapter/naive';

interface Data {
  name: string;
  operation: TriggerOperation;
  newOperation: () => TriggerOperation;
  onSuccess: (instanceId: number) => Promise<unknown> | void;
  onHistory: () => Promise<unknown> | void;
}
const operation = shallowRef<TriggerOperation>();
const name = ref('');
const params = ref('');
const overridden = ref(false);
const attempted = ref(false);
const submitting = ref(false);
const confirmText = computed(() =>
  $t(
    attempted.value
      ? 'job-management.retryExecution'
      : 'job-management.execute',
  ),
);

function restore(request?: TriggerOperation['request']) {
  params.value = request?.params ?? '';
  overridden.value = request?.paramsOverridden ?? false;
  attempted.value = !!request;
}
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  title: $t('job-management.execute'),
  onBeforeClose: () => !submitting.value,
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (!operation.value || submitting.value) return;
    submitting.value = true;
    modalApi.lock();
    const data = modalApi.getData<Data>();
    let instanceId: number | undefined;
    try {
      const pending = operation.value.submit({
        params: params.value,
        paramsOverridden: overridden.value,
      });
      restore(operation.value.request);
      const response = await pending;
      instanceId = response.instanceId;
      message.success($t('job-management.executionRequested'));
    } catch {
      // Keep the request unchanged so a retry cannot create another Instance.
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    if (instanceId !== undefined) {
      modalApi.close();
      await data.onSuccess(instanceId);
    }
  },
  onOpenChange(open) {
    if (!open) {
      operation.value = undefined;
      name.value = '';
      restore();
      return;
    }
    const data = modalApi.getData<Data>();
    name.value = data.name;
    operation.value = data.operation;
    restore(data.operation.request);
  },
});
function newRequest() {
  if (submitting.value) return;
  dialog.warning({
    title: $t('job-management.newRequest'),
    content: $t('job-management.newRequestWarning'),
    positiveText: $t('job-management.newRequest'),
    negativeText: $t('common.cancel'),
    onPositiveClick() {
      operation.value = modalApi.getData<Data>().newOperation();
      restore();
    },
  });
}
async function showHistory() {
  if (submitting.value) return;
  const data = modalApi.getData<Data>();
  modalApi.close();
  await data.onHistory();
}
defineExpose(modalApi);
</script>

<template>
  <Modal class="w-[620px]" :confirm-text="confirmText">
    <p class="mb-4 font-medium">{{ name }}</p>
    <NAlert type="info" class="mb-4">
      {{ $t('job-management.manualHelp') }}
    </NAlert>
    <NAlert v-if="attempted" type="warning" class="mb-4">
      {{ $t('job-management.retryHelpText') }}
    </NAlert>
    <NFormItem :label="$t('job-management.overrideParams')">
      <NSwitch v-model:value="overridden" :disabled="attempted || submitting" />
    </NFormItem>
    <NFormItem v-if="overridden" :label="$t('job-management.params')">
      <NInput
        v-model:value="params"
        type="textarea"
        :disabled="attempted || submitting"
        :autosize="{ minRows: 4, maxRows: 10 }"
        :placeholder="$t('job-management.overridePlaceholder')"
      />
    </NFormItem>
    <NSpace v-if="attempted">
      <NButton :disabled="submitting" size="small" @click="showHistory">
        {{ $t('job-management.history') }}
      </NButton>
      <NButton :disabled="submitting" size="small" @click="newRequest">
        {{ $t('job-management.newRequest') }}
      </NButton>
    </NSpace>
  </Modal>
</template>
