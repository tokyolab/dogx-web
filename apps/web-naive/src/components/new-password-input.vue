<script setup lang="ts">
import type { InputInst } from 'naive-ui';

import { computed, ref } from 'vue';

import { CircleCheckBig } from '@vben/icons';
import { $t } from '@vben/locales';

import { NInput, NPopover, NText } from 'naive-ui';

import {
  getNewPasswordChecks,
  isAllowedPasswordInput,
  MAX_PASSWORD_CHARACTERS,
} from '#/utils/password';

defineOptions({ inheritAttrs: false });
defineProps<{ disabled?: boolean }>();
const value = defineModel<null | string>('value', { default: '' });
const inputRef = ref<InputInst>();
const rules = computed(() => {
  const checks = getNewPasswordChecks(value.value ?? '');
  return (['length', 'categories', 'characters'] as const).map((key) => ({
    key,
    label: $t(`page.auth.passwordRules.${key}`),
    passed: checks[key],
  }));
});

// Vben focuses invalid fields through the registered component's ref.
defineExpose({
  blur: () => inputRef.value?.blur(),
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select(),
});
</script>

<template>
  <NPopover
    :disabled="disabled"
    :keep-alive-on-hover="false"
    placement="top-start"
    :style="{ width: '360px', maxWidth: 'calc(100vw - 32px)' }"
    trigger="focus"
  >
    <template #trigger>
      <NInput
        ref="inputRef"
        v-bind="$attrs"
        v-model:value="value"
        :allow-input="isAllowedPasswordInput"
        :disabled="disabled"
        :input-props="{ autocomplete: 'new-password' }"
        :maxlength="MAX_PASSWORD_CHARACTERS"
        show-password-on="click"
        type="password"
      />
    </template>
    <div class="text-sm">
      <div class="mb-2 font-medium">
        {{ $t('page.auth.passwordRules.title') }}
      </div>
      <ul aria-live="polite" class="m-0 list-none space-y-2 p-0">
        <li
          v-for="rule in rules"
          :key="rule.key"
          :data-password-rule="rule.key"
        >
          <NText
            class="flex items-start gap-2"
            :depth="rule.passed ? undefined : 3"
            :type="rule.passed ? 'success' : undefined"
          >
            <CircleCheckBig aria-hidden="true" class="mt-0.5 size-4 shrink-0" />
            <span class="min-w-0 break-words">
              <span class="sr-only">
                {{
                  $t(
                    `page.auth.passwordRules.${rule.passed ? 'met' : 'unmet'}`,
                  )
                }}：
              </span>
              {{ rule.label }}
            </span>
          </NText>
        </li>
      </ul>
    </div>
  </NPopover>
</template>
