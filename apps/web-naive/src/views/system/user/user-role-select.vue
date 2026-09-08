<script lang="ts" setup>
import type { UserApi } from '#/api/system';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { $t } from '@vben/locales';

import { useDebounceFn } from '@vueuse/core';
import { NSelect } from 'naive-ui';

import { listUserRoleOptionsApi } from '#/api/system';

import { mergeRoleOptions } from './user-form';

const props = withDefaults(
  defineProps<{
    assigned?: UserApi.UserRole[];
    disabled?: boolean;
    value: number[];
  }>(),
  { assigned: () => [], disabled: false },
);
const emit = defineEmits<{ 'update:value': [value: number[]] }>();
const available = ref<UserApi.UserRole[]>([]);
const loading = ref(false);
const keyword = ref('');
const page = ref(0);
const total = ref(0);
let generation = 0;
let disposed = false;

const options = computed(() =>
  mergeRoleOptions(props.assigned, available.value).map((role) => ({
    label:
      role.status === 1 ? role.name : `${role.name} (${$t('common.disabled')})`,
    value: role.id,
  })),
);

async function load(reset = false) {
  // A pending debounced search can fire after the modal unmounts.
  if (disposed) return;
  if (!reset && (loading.value || available.value.length >= total.value))
    return;
  const token = reset ? ++generation : generation;
  const nextPage = reset ? 1 : page.value + 1;
  loading.value = true;
  try {
    const result = await listUserRoleOptionsApi({
      keyword: keyword.value,
      page: nextPage,
      pageSize: 200,
    });
    if (token !== generation) return;
    available.value = reset
      ? result.items
      : [...available.value, ...result.items];
    total.value = result.total;
    page.value = nextPage;
  } catch {
    // The request interceptor shows the error; keep the current selection.
  } finally {
    if (token === generation) loading.value = false;
  }
}

const search = useDebounceFn(() => load(true), 250);
function onSearch(value: string) {
  keyword.value = value;
  // Invalidate the previous response immediately, not only after debounce.
  generation++;
  loading.value = true;
  void search();
}
function onScroll(event: Event) {
  const element = event.target as HTMLElement;
  if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24)
    void load();
}

onMounted(() => load(true));
onBeforeUnmount(() => {
  disposed = true;
  generation++;
});
</script>

<template>
  <NSelect
    :disabled="disabled"
    :loading="loading"
    :options="options"
    :placeholder="$t('page.system.user.rolesPlaceholder')"
    :value="value"
    clearable
    filterable
    multiple
    remote
    @scroll="onScroll"
    @search="onSearch"
    @update:value="(ids: number[]) => emit('update:value', ids)"
  />
</template>
