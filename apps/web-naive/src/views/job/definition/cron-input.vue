<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { $t } from '@vben/locales';
import { formatDateTime } from '@vben/utils';

import { NButton, NInput, NSpace } from 'naive-ui';

import { previewJobCronApi } from '#/api/job/definition';
const props = defineProps<{ disabled?: boolean; value?: string }>();
const emit = defineEmits<{ 'update:value': [value: string] }>();
const loading = ref(false);
const times = ref<string[]>([]);
let generation = 0;
watch(
  () => props.value,
  () => {
    generation++;
    times.value = [];
    loading.value = false;
  },
);
onBeforeUnmount(() => {
  generation++;
});
async function preview() {
  if (!props.value?.trim() || loading.value) return;
  const token = ++generation;
  loading.value = true;
  try {
    const result = await previewJobCronApi(props.value.trim());
    if (token === generation) times.value = result.times;
  } catch {
    /* The global interceptor reports request errors. */
  } finally {
    if (token === generation) loading.value = false;
  }
}
</script>
<template>
  <NSpace vertical class="w-full">
    <NInput
      :value="value"
      :disabled="disabled"
      :maxlength="128"
      placeholder="0 * * * * *"
      @update:value="(value: string) => emit('update:value', value)"
    />
    <NButton
      size="small"
      :disabled="disabled || !value?.trim()"
      :loading="loading"
      @click="preview"
    >
      {{ $t('job-management.previewCron') }}
    </NButton>
    <ul v-if="times.length > 0" class="text-muted-foreground text-sm">
      <li v-for="time in times" :key="time">{{ formatDateTime(time) }}</li>
    </ul>
  </NSpace>
</template>
