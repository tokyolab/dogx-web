<script setup lang="ts">
import type { ProfileUpdate } from '#/api/core/user';

import { onMounted, ref } from 'vue';

import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { NButton, NSpin, NTag } from 'naive-ui';

import { useVbenForm, z } from '#/adapter/form';
import { message } from '#/adapter/naive';
import { getProfileApi, updateProfileApi } from '#/api/core/user';

const userStore = useUserStore();
const loading = ref(true);
const ready = ref(false);
const submitting = ref(false);
const roles = ref<string[]>([]);
const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical',
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('page.system.user.username'),
      componentProps: { disabled: true, placeholder: '' },
    },
    {
      component: 'Input',
      fieldName: 'nickname',
      label: $t('page.system.user.nickname'),
      componentProps: {
        maxlength: 64,
        placeholder: $t('page.system.user.nicknamePlaceholder'),
      },
      rules: z
        .string()
        .trim()
        .min(1, {
          message: $t('page.system.user.required', {
            field: $t('page.system.user.nickname'),
          }),
        })
        .max(64, { message: $t('page.system.user.tooLong', { max: 64 }) }),
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: $t('page.system.user.email'),
      componentProps: {
        maxlength: 255,
        placeholder: $t('page.system.user.emailPlaceholder'),
      },
      rules: z
        .string()
        .trim()
        .max(255, { message: $t('page.system.user.tooLong', { max: 255 }) })
        .refine(
          (value) => !value || z.string().email().safeParse(value).success,
          { message: $t('page.system.user.emailInvalid') },
        )
        .optional(),
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: $t('page.system.user.phone'),
      componentProps: {
        maxlength: 32,
        placeholder: $t('page.system.user.phonePlaceholder'),
      },
      rules: z
        .string()
        .trim()
        .max(32, { message: $t('page.system.user.tooLong', { max: 32 }) })
        .optional(),
    },
    {
      component: 'Input',
      fieldName: 'departmentName',
      label: $t('page.system.user.department'),
      componentProps: { disabled: true, placeholder: '' },
    },
    {
      component: 'Input',
      fieldName: 'roles',
      label: $t('page.system.user.roles'),
    },
  ],
});

async function load() {
  loading.value = true;
  try {
    const profile = await getProfileApi();
    await formApi.setValues(profile);
    roles.value = profile.roles;
    ready.value = true;
  } catch {
    // The request client displays the error; keep saving disabled until retry succeeds.
    ready.value = false;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!ready.value || submitting.value) return;
  submitting.value = true;
  try {
    const validation = await formApi.validate();
    if (!validation.valid) return;
    const values = await formApi.getValues<ProfileUpdate>();
    await updateProfileApi(values);
    if (userStore.userInfo) {
      userStore.setUserInfo({
        ...userStore.userInfo,
        realName: values.nickname.trim(),
      });
    }
    message.success($t('common.saveSuccess'));
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <NSpin :show="loading">
    <div class="w-full max-w-lg">
      <Form>
        <template #roles>
          <div class="flex flex-wrap gap-2">
            <NTag v-for="(role, index) in roles" :key="index" size="small">
              {{ role }}
            </NTag>
          </div>
        </template>
      </Form>
      <NButton v-if="!loading && !ready" @click="load">
        {{ $t('profile.retry') }}
      </NButton>
      <NButton
        v-else
        type="primary"
        :disabled="!ready"
        :loading="submitting"
        @click="save"
      >
        {{ $t('common.confirm') }}
      </NButton>
    </div>
  </NSpin>
</template>
