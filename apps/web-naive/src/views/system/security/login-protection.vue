<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { LoginSecurityConfig } from '#/api/system/security';

import { onMounted, ref } from 'vue';

import { $t } from '@vben/locales';

import { NButton, NSpin, NSwitch } from 'naive-ui';

import { useVbenForm, z } from '#/adapter/form';
import { message } from '#/adapter/naive';
import {
  getLoginSecurityApi,
  updateLoginSecurityApi,
} from '#/api/system/security';

const loading = ref(true);
const ready = ref(false);
const submitting = ref(false);

function numberField(
  fieldName: string,
  label: string,
  min: number,
  max: number,
): VbenFormSchema {
  const error = $t('security.range', { min, max });
  return {
    component: 'InputNumber',
    fieldName,
    label: $t(`security.${label}`),
    componentProps: { min, max, precision: 0, step: 1 },
    rules: z
      .number({ invalid_type_error: error, required_error: error })
      .int(error)
      .min(min, error)
      .max(max, error),
  };
}
const formOptions = {
  commonConfig: { componentProps: { class: 'w-full' } },
  layout: 'vertical' as const,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
};
const [RateForm, rateForm] = useVbenForm({
  ...formOptions,
  wrapperClass: 'flex flex-row flex-wrap items-start gap-x-2',
  schema: [
    {
      component: 'Switch',
      fieldName: 'rateLimitEnabled',
      label: $t('security.rateEnabled'),
      hideLabel: true,
      formItemClass: 'w-full',
      componentProps: { class: '' },
      rules: z.boolean(),
    },
    inlineNumberField(
      'rateLimitWindowSeconds',
      'rateWindow',
      1,
      3600,
      'rateWindowSuffix',
    ),
    inlineNumberField(
      'rateLimitMaxRequests',
      'rateMaximum',
      1,
      10_000,
      'rateMaximumSuffix',
      '6rem',
    ),
  ],
});

function inlineNumberField(
  fieldName: string,
  label: string,
  min: number,
  max: number,
  suffix: string,
  width = '7rem',
): VbenFormSchema {
  const field = numberField(fieldName, label, min, max);
  return {
    ...field,
    hideLabel: true,
    formItemClass: [
      'max-w-full',
      '[&_[id$="-form-item-message"]]:static',
      '[&_[id$="-form-item-message"]]:leading-5',
    ].join(' '),
    componentProps: {
      min,
      max,
      precision: 0,
      step: 1,
      class: '',
      style: { width },
      showButton: false,
      inputProps: { 'aria-label': $t(`security.${label}`) },
    },
    suffix: $t(`security.${suffix}`),
  };
}

const [LockForm, lockForm] = useVbenForm({
  ...formOptions,
  wrapperClass: 'flex flex-row flex-wrap items-start gap-x-2',
  schema: [
    {
      component: 'Switch',
      fieldName: 'failureLockEnabled',
      label: $t('security.failureEnabled'),
      hideLabel: true,
      formItemClass: 'w-full',
      componentProps: { class: '' },
      rules: z.boolean(),
    },
    inlineNumberField(
      'failureWindowSeconds',
      'failureWindow',
      60,
      86_400,
      'failureWindowSuffix',
    ),
    inlineNumberField(
      'failureThreshold',
      'failureThreshold',
      1,
      100,
      'failureThresholdSuffix',
      '6rem',
    ),
    inlineNumberField(
      'lockDurationSeconds',
      'lockDuration',
      60,
      86_400,
      'lockDurationSuffix',
    ),
  ],
});

async function load() {
  loading.value = true;
  ready.value = false;
  try {
    const config = await getLoginSecurityApi();
    await rateForm.setValues({
      rateLimitEnabled: config.rateLimitEnabled,
      rateLimitWindowSeconds: config.rateLimitWindowSeconds,
      rateLimitMaxRequests: config.rateLimitMaxRequests,
    });
    await lockForm.setValues({
      failureLockEnabled: config.failureLockEnabled,
      failureWindowSeconds: config.failureWindowSeconds,
      failureThreshold: config.failureThreshold,
      lockDurationSeconds: config.lockDurationSeconds,
    });
    ready.value = true;
  } catch {
    // Request errors are displayed centrally; never save defaults after a failed load.
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!ready.value || submitting.value) return;
  submitting.value = true;
  try {
    const rateValid = await rateForm.validate();
    const lockValid = await lockForm.validate();
    if (!rateValid.valid || !lockValid.valid) return;
    const values = {
      ...(await rateForm.getValues()),
      ...(await lockForm.getValues()),
    } as LoginSecurityConfig;
    await updateLoginSecurityApi(values);
    message.success($t('common.saveSuccess'));
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <NSpin :show="loading">
    <div class="w-full max-w-3xl">
      <section class="mb-8">
        <RateForm>
          <template #rateLimitEnabled="field">
            <div class="flex items-center gap-3">
              <h3 class="text-base font-normal">
                {{ $t('security.rateLimit') }}
              </h3>
              <NSwitch
                :value="field.value"
                :aria-label="$t('security.rateEnabled')"
                @update:value="field['onUpdate:value']"
              />
            </div>
          </template>
        </RateForm>
        <p class="text-xs text-muted-foreground">
          {{ $t('security.rateHelp') }}
        </p>
      </section>
      <section class="mb-8">
        <LockForm>
          <template #failureLockEnabled="field">
            <div class="flex items-center gap-3">
              <h3 class="text-base font-normal">
                {{ $t('security.failureLock') }}
              </h3>
              <NSwitch
                :value="field.value"
                :aria-label="$t('security.failureEnabled')"
                @update:value="field['onUpdate:value']"
              />
            </div>
          </template>
        </LockForm>
        <p class="text-xs text-muted-foreground">
          {{ $t('security.failureHelp') }}
        </p>
      </section>
      <NButton v-if="!loading && !ready" @click="load">
        {{ $t('security.retry') }}
      </NButton>
      <NButton
        v-else
        type="primary"
        :disabled="!ready"
        :loading="submitting"
        @click="save"
      >
        {{ $t('security.save') }}
      </NButton>
    </div>
  </NSpin>
</template>
