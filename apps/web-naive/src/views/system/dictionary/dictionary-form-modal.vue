<script lang="ts" setup>
import type { DictionaryFormValues } from './dictionary-form';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import {
  createDictionaryApi,
  createDictionaryItemApi,
  getDictionaryApi,
  getDictionaryItemApi,
  updateDictionaryApi,
  updateDictionaryItemApi,
} from '#/api/system/dictionary';

import { dictionaryFormSchema, dictionarySnapshot } from './dictionary-form';

interface ModalData {
  id?: number;
  dictionaryId?: number;
  onSuccess?: () => Promise<void> | void;
}
const currentID = ref<number>();
const itemMode = ref(false);
const ready = ref(false);
const submitting = ref(false);
let initial = '';
let generation = 0;
const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  wrapperClass: 'grid-cols-1',
  schema: dictionaryFormSchema(false, false),
  showDefaultActions: false,
});
const snapshot = async () =>
  dictionarySnapshot(
    await formApi.getValues<DictionaryFormValues>(),
    itemMode.value,
    !!currentID.value,
  );
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  async onBeforeClose() {
    if (submitting.value) return false;
    if (!initial || (await snapshot()) === initial) return true;
    return await new Promise<boolean>((resolve) => {
      dialog.warning({
        title: $t('page.system.role.discardChangesTitle'),
        content: $t('page.system.dictionary.discardContent'),
        positiveText: $t('page.system.role.discardChanges'),
        negativeText: $t('common.cancel'),
        maskClosable: false,
        onClose: () => resolve(false),
        onNegativeClick: () => resolve(false),
        onPositiveClick: () => resolve(true),
      });
    });
  },
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
      const v = await formApi.getValues<DictionaryFormValues>();
      if (data.dictionaryId === undefined) {
        const fields = {
          name: v.name?.trim() ?? '',
          remark: v.remark?.trim() ?? '',
          isPublic: v.isPublic ?? false,
        };
        await (currentID.value
          ? updateDictionaryApi({ ...fields, id: currentID.value })
          : createDictionaryApi({
              ...fields,
              code: v.code ?? '',
              status: v.status ?? 1,
            }));
      } else {
        const fields = {
          label: v.label?.trim() ?? '',
          sort: v.sort ?? 0,
          remark: v.remark?.trim() ?? '',
        };
        await (currentID.value
          ? updateDictionaryItemApi({ ...fields, id: currentID.value })
          : createDictionaryItemApi({
              ...fields,
              dictionaryId: data.dictionaryId,
              value: v.value?.trim() ?? '',
              status: v.status ?? 1,
            }));
      }
      initial = await snapshot();
      message.success($t('common.saveSuccess'));
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    modalApi.close();
    await data.onSuccess?.();
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
    itemMode.value = data.dictionaryId !== undefined;
    const titles = itemMode.value
      ? { create: 'createItem', edit: 'editItem' }
      : { create: 'createTitle', edit: 'editTitle' };
    const title = data.id ? titles.edit : titles.create;
    modalApi.setState({
      title: $t(`page.system.dictionary.${title}`),
      loading: true,
      confirmDisabled: true,
    });
    formApi.setState({
      schema: dictionaryFormSchema(itemMode.value, !!data.id),
    });
    try {
      await nextTick();
      if (token !== generation) return;
      await formApi.resetForm();
      if (token !== generation) return;
      let values: DictionaryFormValues = {
        name: '',
        code: '',
        label: '',
        value: '',
        remark: '',
        sort: 0,
        status: 1,
        isPublic: false,
      };
      if (data.id) {
        if (itemMode.value) {
          const detail = await getDictionaryItemApi(data.id);
          values = detail.item;
        } else {
          const detail = await getDictionaryApi(data.id);
          values = detail.dictionary;
        }
      }
      if (token !== generation) return;
      await formApi.setValues(values);
      await nextTick();
      if (token !== generation) return;
      initial = await snapshot();
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
