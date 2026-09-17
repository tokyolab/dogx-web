<script lang="ts" setup>
import type { MenuFormValues } from './menu-form';

import type { MenuApi } from '#/api/system/menu';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import { createMenuApi, getMenuApi, updateMenuApi } from '#/api/system/menu';

import {
  menuFormValues,
  menuPayload,
  menuSnapshot,
  newMenuValues,
} from './menu-form';
import { menuFormSchema } from './menu-form-schema';

interface ModalData {
  id?: number;
  items: MenuApi.Item[];
  parentId?: number;
  type?: number;
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
    menuSnapshot(
      await formApi.getValues<MenuFormValues>(),
      !!currentID.value,
    ) === initial
  )
    return true;
  return await new Promise<boolean>((resolve) => {
    dialog.warning({
      title: $t('page.system.role.discardChangesTitle'),
      content: $t('page.system.menu.discardContent'),
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
  schema: menuFormSchema([]),
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
      const values = await formApi.getValues<MenuFormValues>();
      const payload = menuPayload(values);
      await (currentID.value
        ? updateMenuApi({ ...payload, id: currentID.value })
        : createMenuApi({ ...payload, status: values.status ?? 1 }));
      initial = menuSnapshot(values, !!currentID.value);
      message.success($t('page.system.menu.saveSuccess'));
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
          ? 'page.system.menu.editTitle'
          : 'page.system.menu.createTitle',
      ),
    });
    formApi.setState({ schema: menuFormSchema(data.items, currentID.value) });
    try {
      await nextTick();
      if (token !== generation) return;
      await formApi.resetForm();
      if (token !== generation) return;
      const values = currentID.value
        ? menuFormValues(await getMenuApi(currentID.value))
        : newMenuValues(data.parentId, data.type);
      if (token !== generation) return;
      await formApi.setValues(values);
      await nextTick();
      if (token !== generation) return;
      // Snapshot the populated form, not the full DTO: Vben may omit hidden fields.
      initial = menuSnapshot(
        await formApi.getValues<MenuFormValues>(),
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
