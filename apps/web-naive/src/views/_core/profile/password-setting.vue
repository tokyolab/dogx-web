<script setup lang="ts">
import { ref } from 'vue';

import { $t } from '@vben/locales';

import { NButton } from 'naive-ui';

import { useVbenForm, z } from '#/adapter/form';
import { message } from '#/adapter/naive';
import { changePasswordApi } from '#/api/core/auth';
import { useAuthStore } from '#/store';
import { isValidNewPassword } from '#/utils/password';

const authStore = useAuthStore();
const submitting = ref(false);
const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      component: 'Input',
      fieldName: 'currentPassword',
      label: $t('profile.currentPassword'),
      componentProps: {
        type: 'password',
        showPasswordOn: 'click',
        autocomplete: 'current-password',
        placeholder: $t('profile.currentPasswordPlaceholder'),
      },
      rules: z
        .string()
        .min(1, { message: $t('profile.currentPasswordPlaceholder') }),
    },
    {
      component: 'NewPasswordInput',
      fieldName: 'newPassword',
      label: $t('page.system.user.newPassword'),
      componentProps: {
        placeholder: $t('page.system.user.newPasswordPlaceholder'),
      },
      rules: z.string().refine(isValidNewPassword, {
        message: $t('page.auth.passwordRules.invalid'),
      }),
    },
    {
      component: 'Input',
      fieldName: 'confirmPassword',
      label: $t('profile.confirmPassword'),
      componentProps: {
        type: 'password',
        showPasswordOn: 'click',
        autocomplete: 'new-password',
        maxlength: 32,
        placeholder: $t('profile.confirmPasswordPlaceholder'),
      },
      dependencies: {
        triggerFields: ['newPassword'],
        rules: (values) =>
          z
            .string({
              required_error: $t('profile.confirmPasswordPlaceholder'),
              invalid_type_error: $t('profile.confirmPasswordPlaceholder'),
            })
            .min(1, { message: $t('profile.confirmPasswordPlaceholder') })
            .refine((value) => value === values.newPassword, {
              message: $t('profile.passwordMismatch'),
            }),
      },
    },
  ],
});

async function save() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const validation = await formApi.validate();
    if (!validation.valid) return;
    const values = await formApi.getValues<{
      currentPassword: string;
      newPassword: string;
    }>();
    await changePasswordApi(values.currentPassword, values.newPassword);
    message.success($t('common.saveSuccess'));
    // The server has revoked all sessions; do not send another authenticated logout request.
    await authStore.logout(false, false);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="w-full max-w-lg">
    <Form />
    <p class="mb-4 text-sm text-muted-foreground">
      {{ $t('profile.passwordLogoutHelp') }}
    </p>
    <NButton type="primary" :loading="submitting" @click="save">
      {{ $t('common.confirm') }}
    </NButton>
  </div>
</template>
