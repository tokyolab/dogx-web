<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';
import { isPasswordWithinByteLimit } from '#/utils/password';
import { isValidUsername, MAX_USERNAME_CHARACTERS } from '#/utils/username';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

async function handleSubmit(values: Recordable<any>) {
  try {
    await authStore.authLogin({
      password: String(values.password ?? ''),
      username: String(values.username ?? ''),
    });
  } catch {
    // 请求层已经统一展示后端错误消息，页面事件边界只负责消费异常。
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
        title: $t('page.auth.usernameRules'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.usernameTip') })
        .max(MAX_USERNAME_CHARACTERS, {
          message: $t('page.auth.usernameTooLong'),
        })
        .refine(isValidUsername, { message: $t('page.auth.usernameInvalid') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.passwordTip') })
        .refine(isPasswordWithinByteLimit, {
          message: $t('page.auth.passwordTooLong'),
        }),
    },
  ];
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    @submit="handleSubmit"
  />
</template>
