<script setup lang="ts">
import type { ExecutorGroupApi, GroupOptionLoader } from '#/api/job/group';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { $t } from '@vben/locales';

import { useDebounceFn } from '@vueuse/core';
import { NSelect } from 'naive-ui';

import { listExecutorGroupsApi } from '#/api/job/group';

const props = defineProps<{
  assigned?: { id: number; name: string };
  disabled?: boolean;
  loader?: GroupOptionLoader;
  placeholder?: string;
  value?: null | number;
}>();
const emit = defineEmits<{ 'update:value': [value: null | number] }>();
const available = ref<ExecutorGroupApi.Item[]>([]);
const selected = ref<{ id: number; name: string }>();
const loading = ref(false);
let keyword = '';
let page = 0;
let total = 0;
let generation = 0;
let disposed = false;
const options = computed(() => {
  const items = new Map(
    available.value.map((item) => [
      item.id,
      { label: item.name, value: item.id },
    ]),
  );
  for (const item of [props.assigned, selected.value]) {
    if (item && item.id === props.value)
      items.set(item.id, { label: item.name, value: item.id });
  }
  return [...items.values()];
});
async function load(reset = false) {
  if (
    disposed ||
    (!reset && (loading.value || available.value.length >= total))
  )
    return;
  const token = reset ? ++generation : generation;
  const nextPage = reset ? 1 : page + 1;
  loading.value = true;
  try {
    const result = await (props.loader ?? listExecutorGroupsApi)({
      name: keyword,
      page: nextPage,
      pageSize: 50,
    });
    if (token !== generation || disposed) return;
    available.value = reset
      ? result.items
      : [...available.value, ...result.items];
    page = nextPage;
    total = result.total;
  } catch {
    // The request interceptor owns errors. Existing selections remain usable.
  } finally {
    if (token === generation) loading.value = false;
  }
}
const search = useDebounceFn(() => load(true), 250);
function onSearch(value: string) {
  keyword = value.trim();
  generation++;
  available.value = [];
  page = 0;
  total = 0;
  loading.value = true;
  void search();
}
function onScroll(event: Event) {
  const element = event.target as HTMLElement;
  if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24)
    void load();
}
function onChange(value: null | number) {
  const item = available.value.find((candidate) => candidate.id === value);
  selected.value = item ? { id: item.id, name: item.name } : undefined;
  emit('update:value', value);
}
onMounted(() => load(true));
onBeforeUnmount(() => {
  disposed = true;
  generation++;
});
</script>
<template>
  <NSelect
    :value="value"
    :options="options"
    :loading="loading"
    :disabled="disabled"
    :placeholder="placeholder ?? $t('job-group.select')"
    clearable
    filterable
    remote
    @search="onSearch"
    @scroll="onScroll"
    @update:value="onChange"
  />
</template>
