<script lang="ts" setup>
import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { useVbenForm, z } from '#/adapter/form';
import { message } from '#/adapter/naive';
import { resetUserPasswordApi } from '#/api/system';
import { useAuthStore } from '#/store';
import { isValidNewPassword } from '#/utils/password';

interface ModalData {
  id: number;
  nickname: string;
}
const submitting = ref(false);
const userStore = useUserStore();
const authStore = useAuthStore();
const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      component: 'Input',
      componentProps: {
        autocomplete: 'new-password',
        showPasswordOn: 'click',
        type: 'password',
      },
      fieldName: 'password',
      help: $t('page.system.user.passwordLength'),
      label: $t('page.system.user.newPassword'),
      rules: z.string().refine(isValidNewPassword, {
        message: $t('page.system.user.passwordLength'),
      }),
    },
  ],
});
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onBeforeClose: () => !submitting.value,
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    if (submitting.value) return;
    submitting.value = true;
    modalApi.lock();
    const data = modalApi.getData<ModalData>();
    try {
      const validation = await formApi.validate();
      if (!validation.valid) return;
      const { password } = await formApi.getValues<{ password: string }>();
      await resetUserPasswordApi(data.id, password);
      message.success($t('page.system.user.passwordReset'));
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    modalApi.close();
    if (data.id === Number(userStore.userInfo?.userId))
      await authStore.logout(false, false);
  },
  async onOpenChange(open) {
    await nextTick();
    await formApi.resetForm();
    if (!open) return;
    await formApi.setValues({ password: '' });
    modalApi.setState({
      title: `${$t('page.system.user.resetPassword')} · ${modalApi.getData<ModalData>().nickname}`,
    });
  },
});
defineExpose(modalApi);
</script>

<template>
  <Modal><Form /></Modal>
</template>
