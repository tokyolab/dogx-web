<script lang="ts" setup>
import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { useVbenForm, z } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import { resetUserPasswordApi } from '#/api/system';
import { useAuthStore } from '#/store';
import { isValidNewPassword } from '#/utils/password';

interface ModalData {
  id: number;
  nickname: string;
}
const submitting = ref(false);
let saved = false;
const userStore = useUserStore();
const authStore = useAuthStore();

async function beforeClose() {
  if (submitting.value) return false;
  // A successful reset closes programmatically with the password still filled.
  if (saved) return true;
  const { password } = await formApi.getValues<{ password?: string }>();
  if (!password) return true;

  return await new Promise<boolean>((resolve) => {
    dialog.warning({
      content: $t('page.system.user.passwordDiscardContent'),
      maskClosable: false,
      negativeText: $t('common.cancel'),
      onClose: () => resolve(false),
      onNegativeClick: () => resolve(false),
      onPositiveClick: () => resolve(true),
      positiveText: $t('page.system.role.discardChanges'),
      title: $t('page.system.role.discardChangesTitle'),
    });
  });
}

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      component: 'NewPasswordInput',
      componentProps: {
        placeholder: $t('page.system.user.newPasswordPlaceholder'),
      },
      fieldName: 'password',
      label: $t('page.system.user.newPassword'),
      rules: z.string().refine(isValidNewPassword, {
        message: $t('page.auth.passwordRules.invalid'),
      }),
    },
  ],
});
const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onBeforeClose: beforeClose,
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
      saved = true;
      message.success($t('common.passwordResetSuccess'));
    } finally {
      submitting.value = false;
      modalApi.unlock();
    }
    modalApi.close();
    if (data.id === Number(userStore.userInfo?.userId))
      await authStore.logout(false, false);
  },
  async onOpenChange(open) {
    saved = false;
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
