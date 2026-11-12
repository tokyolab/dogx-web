<script setup lang="ts">
import type { ExecutorGroupApi } from '#/api/job/group';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { formatDateTime } from '@vben/utils';

import {
  NAlert,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NSpace,
} from 'naive-ui';

import { useVbenForm, z } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import { createExecutorGroupApi, getExecutorGroupApi } from '#/api/job/group';

interface Data {
  id?: number;
  onSuccess?: () => Promise<void> | void;
}
const detail = ref<ExecutorGroupApi.Detail>();
const revealed = ref(false);
const submitting = ref(false);
const ready = ref(false);
let generation = 0;
let initial = '';
const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1',
  showDefaultActions: false,
  schema: [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('job-group.name'),
      help: $t('job-group.identityHelp'),
      componentProps: { maxlength: 128 },
      rules: z.string().min(1).max(128),
    },
    {
      component: 'Input',
      fieldName: 'discoveryKey',
      label: $t('job-group.discoveryKey'),
      help: $t('job-group.keyHelp'),
      componentProps: { maxlength: 255 },
      rules: z.string().min(1).max(255),
    },
  ],
});
async function snapshot() {
  const values = await formApi.getValues<{
    discoveryKey: string;
    name: string;
  }>();
  return JSON.stringify({
    name: values.name ?? '',
    discoveryKey: values.discoveryKey ?? '',
  });
}
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  async onBeforeClose() {
    if (submitting.value) return false;
    if (
      detail.value ||
      !ready.value ||
      !initial ||
      (await snapshot()) === initial
    )
      return true;
    return await new Promise<boolean>((resolve) =>
      dialog.warning({
        title: $t('job-group.discardTitle'),
        content: $t('job-group.discard'),
        positiveText: $t('common.confirm'),
        negativeText: $t('common.cancel'),
        maskClosable: false,
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
      }),
    );
  },
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (submitting.value || !ready.value || detail.value) return;
    submitting.value = true;
    modalApi.lock();
    try {
      const validation = await formApi.validate();
      if (!validation.valid) return;
      await createExecutorGroupApi(
        await formApi.getValues<{ discoveryKey: string; name: string }>(),
      );
      initial = await snapshot();
      message.success($t('common.saveSuccess'));
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    const data = modalApi.getData<Data>();
    modalApi.close();
    await data.onSuccess?.();
  },
  async onOpenChange(open) {
    const token = ++generation;
    detail.value = undefined;
    revealed.value = false;
    ready.value = false;
    initial = '';
    if (!open) return;
    const data = modalApi.getData<Data>();
    modalApi.setState({
      loading: true,
      confirmDisabled: true,
      showConfirmButton: !data.id,
      title: $t(data.id ? 'job-group.detail' : 'job-group.create'),
    });
    try {
      await nextTick();
      if (token !== generation) return;
      await formApi.resetForm();
      if (token !== generation) return;
      if (data.id) {
        const response = await getExecutorGroupApi(data.id);
        if (token !== generation) return;
        detail.value = response;
      } else {
        await formApi.setValues({ name: '', discoveryKey: '' });
        if (token !== generation) return;
        const current = await snapshot();
        if (token !== generation) return;
        initial = current;
      }
      if (token === generation) ready.value = true;
    } catch {
      if (token === generation) modalApi.close();
    } finally {
      if (token === generation)
        modalApi.setState({ loading: false, confirmDisabled: !ready.value });
    }
  },
});
async function copyToken() {
  if (!detail.value) return;
  try {
    await navigator.clipboard.writeText(detail.value.token);
    message.success($t('job-group.copied'));
  } catch {
    message.error($t('job-group.copyFailed'));
  }
}
defineExpose(modalApi);
</script>
<template>
  <Modal class="w-[620px]">
    <template v-if="detail">
      <NDescriptions :column="1" bordered>
        <NDescriptionsItem :label="$t('job-group.name')">
          {{ detail.name }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-group.discoveryKey')">
          <span class="break-all">{{ detail.discoveryKey }}</span>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-group.token')">
          <NSpace vertical>
            <code class="break-all">{{
              revealed ? detail.token : '••••••••••••••••••••••••••••••••'
            }}</code>
            <NSpace>
              <NButton size="small" @click="revealed = !revealed">
                {{ $t(revealed ? 'job-group.hide' : 'job-group.show') }}
              </NButton>
              <NButton size="small" @click="copyToken">
                {{ $t('job-group.copy') }}
              </NButton>
            </NSpace>
          </NSpace>
        </NDescriptionsItem>
        <NDescriptionsItem :label="$t('job-group.createdAt')">
          {{ formatDateTime(detail.createdAt) }}
        </NDescriptionsItem>
      </NDescriptions>
    </template>
    <template v-else>
      <NAlert type="info" class="mb-4">
        {{ $t('job-group.immutable') }}
      </NAlert>
      <Form />
    </template>
  </Modal>
</template>
