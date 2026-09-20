<script lang="ts" setup>
import type { DepartmentFormValues } from './department-form';

import type { DepartmentApi } from '#/api/system/department';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import {
  createDepartmentApi,
  getDepartmentApi,
  updateDepartmentApi,
} from '#/api/system/department';

import {
  departmentPayload,
  departmentSnapshot,
  newDepartmentValues,
} from './department-form';
import { departmentFormSchema } from './department-form-schema';

interface ModalData {
  id?: number;
  items: DepartmentApi.Item[];
  parentId?: number;
  onSuccess?: () => Promise<void> | void;
}
const currentID = ref<number>();
const ready = ref(false);
const submitting = ref(false);
let initial = '';
let generation = 0;

async function beforeClose() {
  if (submitting.value) return false;
  if (
    !initial ||
    departmentSnapshot(
      await formApi.getValues<DepartmentFormValues>(),
      !!currentID.value,
    ) === initial
  )
    return true;
  return await new Promise<boolean>((resolve) => {
    dialog.warning({
      title: $t('page.system.role.discardChangesTitle'),
      content: $t('page.system.department.discardContent'),
      positiveText: $t('page.system.role.discardChanges'),
      negativeText: $t('common.cancel'),
      maskClosable: false,
      onClose: () => resolve(false),
      onNegativeClick: () => resolve(false),
      onPositiveClick: () => resolve(true),
    });
  });
}
const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  wrapperClass: 'grid-cols-1',
  schema: departmentFormSchema([]),
  showDefaultActions: false,
});
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onBeforeClose: beforeClose,
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (submitting.value || !ready.value) return;
    submitting.value = true;
    modalApi.lock();
    const data = modalApi.getData<ModalData>();
    try {
      const validation = await formApi.validate();
      if (!validation.valid) return;
      const values = await formApi.getValues<DepartmentFormValues>();
      const payload = departmentPayload(values);
      await (currentID.value
        ? updateDepartmentApi({ ...payload, id: currentID.value })
        : createDepartmentApi({ ...payload, status: values.status ?? 1 }));
      initial = departmentSnapshot(values, !!currentID.value);
      message.success($t('common.saveSuccess'));
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    modalApi.close();
    await data?.onSuccess?.();
  },
  async onOpenChange(open) {
    const token = ++generation;
    ready.value = false;
    initial = '';
    if (!open) {
      currentID.value = undefined;
      return;
    }
    const data = modalApi.getData<ModalData>();
    currentID.value = data.id;
    modalApi.setState({
      confirmDisabled: true,
      loading: true,
      title: $t(
        currentID.value
          ? 'page.system.department.editTitle'
          : 'page.system.department.createTitle',
      ),
    });
    formApi.setState({
      schema: departmentFormSchema(data.items, currentID.value),
    });
    try {
      await nextTick();
      if (token !== generation) return;
      await formApi.resetForm();
      if (token !== generation) return;
      const values = currentID.value
        ? await getDepartmentApi(currentID.value)
        : newDepartmentValues(data.parentId);
      if (token !== generation) return;
      await formApi.setValues(values);
      await nextTick();
      if (token !== generation) return;
      // Snapshot the populated form, not the full DTO: Vben may omit hidden fields.
      initial = departmentSnapshot(
        await formApi.getValues<DepartmentFormValues>(),
        !!currentID.value,
      );
      if (token !== generation) return;
      ready.value = true;
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
  <Modal><Form /></Modal>
</template>
