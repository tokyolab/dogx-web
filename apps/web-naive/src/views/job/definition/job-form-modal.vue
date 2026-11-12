<script setup lang="ts">
import type { JobDefinitionApi } from '#/api/job/definition';
import type { GroupOptionLoader } from '#/api/job/group';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NAlert } from 'naive-ui';

import { useVbenForm } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import {
  createJobDefinitionApi,
  getJobDefinitionApi,
  updateJobDefinitionApi,
} from '#/api/job/definition';

import GroupSelect from '../group/group-select.vue';
import { defaultJobInput, jobFormSchema, normalizeJobInput } from './job-form';

interface Data {
  id?: number;
  loadGroups?: GroupOptionLoader;
  onSuccess?: () => Promise<void> | void;
}
const ready = ref(false);
const submitting = ref(false);
const currentID = ref<number>();
const assigned = ref<{ id: number; name: string }>();
const loader = ref<GroupOptionLoader>();
let generation = 0;
let initial = '';
const [Form, formApi] = useVbenForm({
  schema: jobFormSchema(),
  showDefaultActions: false,
  layout: 'vertical',
  wrapperClass: 'grid-cols-1',
  commonConfig: { componentProps: { class: 'w-full' } },
});
async function snapshot() {
  return JSON.stringify(
    normalizeJobInput(await formApi.getValues<JobDefinitionApi.Input>()),
  );
}
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  async onBeforeClose() {
    if (submitting.value) return false;
    if (!ready.value || !initial || (await snapshot()) === initial) return true;
    return await new Promise<boolean>((resolve) =>
      dialog.warning({
        title: $t('job-management.discardTitle'),
        content: $t('job-management.discard'),
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
    if (!ready.value || submitting.value) return;
    submitting.value = true;
    modalApi.lock();
    try {
      const validation = await formApi.validate();
      if (!validation.valid) return;
      const input = normalizeJobInput(
        await formApi.getValues<JobDefinitionApi.Input>(),
      );
      await (currentID.value
        ? updateJobDefinitionApi({ ...input, id: currentID.value })
        : createJobDefinitionApi({ ...input, status: 0 }));
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
    ready.value = false;
    initial = '';
    assigned.value = undefined;
    if (!open) {
      currentID.value = undefined;
      return;
    }
    const data = modalApi.getData<Data>();
    currentID.value = data.id;
    loader.value = data.loadGroups;
    modalApi.setState({
      loading: true,
      confirmDisabled: true,
      title: $t(data.id ? 'job-management.edit' : 'job-management.create'),
    });
    try {
      const record = data.id ? await getJobDefinitionApi(data.id) : undefined;
      if (token !== generation) return;
      if (record && record.status !== 0) {
        message.warning($t('job-management.disableBeforeEdit'));
        modalApi.close();
        return;
      }
      if (record)
        assigned.value = {
          id: record.executorGroupId,
          name: record.executorGroupName ?? `#${record.executorGroupId}`,
        };
      await nextTick();
      if (token !== generation) return;
      await formApi.resetForm();
      if (token !== generation) return;
      await formApi.setValues(
        record ? normalizeJobInput(record) : defaultJobInput(),
      );
      if (token !== generation) return;
      initial = await snapshot();
      if (token === generation) ready.value = true;
    } catch {
      if (token === generation) modalApi.close();
    } finally {
      if (token === generation)
        modalApi.setState({ loading: false, confirmDisabled: !ready.value });
    }
  },
});
defineExpose(modalApi);
</script>
<template>
  <Modal class="w-[680px]">
    <NAlert type="info" class="mb-4">
      {{
        $t(currentID ? 'job-management.editHelp' : 'job-management.createHelp')
      }}
    </NAlert>
    <Form>
      <template #executorGroupId="{ value, handleChange }">
        <GroupSelect
          v-if="ready"
          :value="value > 0 ? value : undefined"
          :assigned="assigned"
          :loader="loader"
          :disabled="submitting"
          @update:value="handleChange"
        />
        <span v-else></span>
      </template>
    </Form>
  </Modal>
</template>
