<script lang="ts" setup>
import type { DictionaryApi } from '#/api/system/dictionary';

import { computed, h, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { ChevronDown, EmptyIcon } from '@vben/icons';
import { $t } from '@vben/locales';

import {
  NButton,
  NDropdown,
  NEllipsis,
  NInput,
  NPopconfirm,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
} from 'naive-ui';

import { dialog, message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  clearDictionaryCacheApi,
  deleteDictionaryApi,
  deleteDictionaryItemApi,
  listDictionariesApi,
  listDictionaryItemsApi,
  updateDictionaryItemStatusApi,
  updateDictionaryStatusApi,
} from '#/api/system/dictionary';

import DictionaryFormModal from './dictionary-form-modal.vue';

const t = (key: string) => $t(`page.system.dictionary.${key}`);
const dictionaries = ref<DictionaryApi.Dictionary[]>([]);
const keyword = ref('');
const loading = ref(false);
const loadFailed = ref(false);
const filteredDictionaries = computed(() => {
  const search = keyword.value.trim().toLowerCase();
  return dictionaries.value.filter(
    (row) =>
      row.name.toLowerCase().includes(search) ||
      row.code.toLowerCase().includes(search),
  );
});
const selected = ref<DictionaryApi.Dictionary>();
const pending = ref(false);
const statusUpdatingItemID = ref<number>();
const statusUpdatingDictionaryID = ref<number>();
const deletingItemID = ref<number>();
const deletingDictionaryID = ref<number>();
const clearing = ref(false);
const itemRows = ref<DictionaryApi.Item[]>([]);
let itemGeneration = 0;
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: DictionaryFormModal,
});
const sharedColumns = [
  {
    field: 'status',
    title: t('status'),
    width: 90,
    slots: { default: 'status' },
  },
  {
    field: 'operation',
    title: t('operation'),
    width: 140,
    fixed: 'right' as const,
    slots: { default: 'operation' },
  },
];
const [ItemGrid, itemGridApi] = useVbenVxeGrid<DictionaryApi.Item>({
  gridOptions: {
    columns: [
      { field: 'label', title: t('label'), minWidth: 140 },
      { field: 'value', title: t('value'), minWidth: 140 },
      { field: 'sort', title: t('sort'), width: 80 },
      { field: 'remark', title: t('remark'), minWidth: 160 },
      ...sharedColumns,
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    proxyConfig: {
      autoLoad: false,
      ajax: {
        query: async () => {
          const token = ++itemGeneration;
          const id = selected.value?.id;
          const result = id ? await listDictionaryItemsApi(id) : { items: [] };
          // A slower response for the previous dictionary must not overwrite the current selection.
          if (token === itemGeneration) itemRows.value = result.items;
          return { items: itemRows.value };
        },
      },
    },
  },
});
async function loadDictionaries() {
  if (loading.value) return;
  loading.value = true;
  loadFailed.value = false;
  try {
    const response = await listDictionariesApi();
    dictionaries.value = response.items;
    const next =
      response.items.find((row) => row.id === selected.value?.id) ??
      response.items[0];
    // Keep selection when editing metadata; do not refetch unchanged dictionary items.
    void selectDictionary(next).catch(() => undefined);
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(loadDictionaries);

function dictionaryActions() {
  return [
    { key: 'edit', label: $t('common.edit'), disabled: pending.value },
    {
      key: 'delete',
      label: () =>
        h(
          'span',
          { class: pending.value ? undefined : 'text-destructive' },
          $t('common.delete'),
        ),
      disabled: pending.value,
    },
  ];
}
function onDictionaryAction(
  key: number | string,
  row: DictionaryApi.Dictionary,
) {
  if (pending.value) return;
  if (key === 'edit') {
    openForm(false, row.id);
    return;
  }
  dialog.warning({
    title: $t('common.delete'),
    content: $t('page.system.dictionary.deleteConfirm', { name: row.name }),
    negativeText: $t('common.cancel'),
    positiveText: $t('common.delete'),
    positiveButtonProps: { type: 'error' },
    onPositiveClick: () => confirmMutation(false, row, true),
  });
}
async function selectDictionary(row?: DictionaryApi.Dictionary) {
  const changed = row?.id !== selected.value?.id;
  selected.value = row;
  if (changed) {
    itemRows.value = [];
    await itemGridApi.query();
  }
}
function openForm(item: boolean, id?: number) {
  if (item && !selected.value) return;
  formModalApi
    .setData({
      id,
      dictionaryId: item ? selected.value?.id : undefined,
      onSuccess: () => (item ? itemGridApi.query() : loadDictionaries()),
    })
    .open();
}
function confirmMutation(
  item: boolean,
  row: { id: number; status: number },
  deleting: boolean,
) {
  if (pending.value) return false;
  pending.value = true;
  if (item && !deleting) statusUpdatingItemID.value = row.id;
  if (!item && !deleting) statusUpdatingDictionaryID.value = row.id;
  if (item && deleting) deletingItemID.value = row.id;
  if (!item && deleting) deletingDictionaryID.value = row.id;
  void mutate(item, row.id, deleting, row.status === 1 ? 0 : 1).catch(
    () => undefined,
  );
  return true;
}
async function mutate(
  item: boolean,
  id: number,
  deleting: boolean,
  status: number,
) {
  try {
    if (item)
      await (deleting
        ? deleteDictionaryItemApi(id)
        : updateDictionaryItemStatusApi(id, status));
    else
      await (deleting
        ? deleteDictionaryApi(id)
        : updateDictionaryStatusApi(id, status));
    let successKey = 'common.deleteSuccess';
    if (!deleting)
      successKey =
        status === 1 ? 'common.enableSuccess' : 'common.disableSuccess';
    message.success($t(successKey));
    await (item ? itemGridApi.query() : loadDictionaries());
  } finally {
    statusUpdatingItemID.value = undefined;
    statusUpdatingDictionaryID.value = undefined;
    deletingItemID.value = undefined;
    deletingDictionaryID.value = undefined;
    pending.value = false;
  }
}
async function clearCache() {
  if (clearing.value) return;
  clearing.value = true;
  try {
    await clearDictionaryCacheApi();
    message.success(t('cacheCleared'));
  } finally {
    clearing.value = false;
  }
}
</script>
<template>
  <Page auto-content-height>
    <FormModal />
    <div
      class="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]"
    >
      <section class="bg-card flex min-h-0 flex-col rounded-lg">
        <div class="border-border space-y-3 border-b p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-medium">{{ t('listTitle') }}</h2>
            <div class="flex items-center gap-2">
              <NButton type="primary" @click="openForm(false)">
                {{ t('createTitle') }}
              </NButton>
              <NButton
                quaternary
                :loading="clearing"
                :disabled="clearing"
                @click="clearCache"
              >
                {{ t('refreshCache') }}
              </NButton>
            </div>
          </div>
          <NInput
            v-model:value="keyword"
            clearable
            :placeholder="t('searchPlaceholder')"
            :input-props="{ 'aria-label': t('searchPlaceholder') }"
          />
        </div>
        <NSpin :show="loading" class="min-h-0 flex-1" content-class="h-full">
          <div class="h-full max-h-80 overflow-y-auto p-2 lg:max-h-none">
            <div v-if="loadFailed" class="dictionary-empty py-12">
              <EmptyIcon class="mx-auto" />
              <div class="mt-2">{{ t('loadFailed') }}</div>
              <NButton class="mt-3" size="small" @click="loadDictionaries">
                {{ t('retry') }}
              </NButton>
            </div>
            <div
              v-else-if="!loading && filteredDictionaries.length === 0"
              class="dictionary-empty py-12"
            >
              <EmptyIcon class="mx-auto" />
              <div class="mt-2">
                {{ keyword.trim() ? t('noMatches') : t('noDictionaries') }}
              </div>
            </div>
            <div
              v-for="row in filteredDictionaries"
              v-else
              :key="row.id"
              class="mb-1 flex items-center gap-1 rounded-md pr-2 transition-colors"
              :class="
                selected?.id === row.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent'
              "
            >
              <button
                type="button"
                class="focus-visible:ring-ring min-w-0 flex-1 rounded-md px-3 py-3 text-left outline-none focus-visible:ring-2"
                :aria-pressed="selected?.id === row.id"
                @click="selectDictionary(row)"
              >
                <span class="block text-sm font-medium">
                  <NEllipsis class="max-w-full align-middle">
                    {{ row.name }}
                  </NEllipsis>
                </span>
                <span class="text-muted-foreground mt-1 block text-xs">
                  <NEllipsis class="max-w-full align-middle">
                    {{ row.code }}
                  </NEllipsis>
                </span>
              </button>
              <NPopconfirm
                :disabled="pending"
                :negative-text="$t('common.cancel')"
                :positive-text="$t('common.confirm')"
                @positive-click="confirmMutation(false, row, false)"
              >
                <template #trigger>
                  <NSwitch
                    class="mx-2 shrink-0"
                    :disabled="pending"
                    :loading="statusUpdatingDictionaryID === row.id"
                    :value="row.status === 1"
                    :aria-label="`${row.name} · ${t('status')}`"
                  />
                </template>
                {{
                  $t(
                    row.status === 1
                      ? 'page.system.dictionary.disableConfirm'
                      : 'page.system.dictionary.enableConfirm',
                    { name: row.name },
                  )
                }}
              </NPopconfirm>
              <NDropdown
                trigger="click"
                :options="dictionaryActions()"
                @select="onDictionaryAction($event, row)"
              >
                <NButton
                  quaternary
                  size="small"
                  :disabled="pending"
                  :loading="deletingDictionaryID === row.id"
                  :aria-label="`${row.name} · ${t('more')}`"
                >
                  {{ t('more') }}
                  <ChevronDown class="ml-1 size-3" />
                </NButton>
              </NDropdown>
            </div>
          </div>
        </NSpin>
      </section>
      <section class="bg-card flex min-h-0 min-w-0 flex-col rounded-lg">
        <div
          v-if="selected"
          class="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2 class="min-w-0 text-base font-medium">
                <NEllipsis class="max-w-full align-middle">
                  {{ selected.name }}
                </NEllipsis>
              </h2>
              <NTag
                size="small"
                :bordered="false"
                :type="selected.isPublic ? 'success' : 'default'"
              >
                {{ selected.isPublic ? t('public') : t('private') }}
              </NTag>
              <NTag v-if="selected.status !== 1" size="small" :bordered="false">
                {{ $t('common.disabled') }}
              </NTag>
            </div>
            <div class="text-muted-foreground mt-1 text-xs">
              <NEllipsis class="max-w-full align-middle">
                {{ selected.code }}
              </NEllipsis>
            </div>
          </div>
          <NButton type="primary" @click="openForm(true)">
            {{ t('createItem') }}
          </NButton>
        </div>
        <div
          v-if="!selected"
          class="flex min-h-64 flex-1 items-center justify-center"
        >
          <div class="dictionary-empty">
            <EmptyIcon class="mx-auto" />
            <div class="mt-2">{{ t('selectDictionary') }}</div>
          </div>
        </div>
        <ItemGrid v-show="selected" class="min-h-0 flex-1">
          <template #status="{ row }">
            <NPopconfirm
              :disabled="pending"
              :negative-text="$t('common.cancel')"
              :positive-text="$t('common.confirm')"
              @positive-click="confirmMutation(true, row, false)"
            >
              <template #trigger>
                <NSwitch
                  :disabled="pending"
                  :loading="statusUpdatingItemID === row.id"
                  :value="row.status === 1"
                />
              </template>
              {{
                $t(
                  row.status === 1
                    ? 'page.system.dictionary.disableConfirm'
                    : 'page.system.dictionary.enableConfirm',
                  { name: row.label },
                )
              }}
            </NPopconfirm>
          </template>
          <template #operation="{ row }">
            <NSpace :size="4" justify="center" :wrap="false">
              <NButton
                :disabled="pending"
                quaternary
                size="small"
                type="primary"
                @click="openForm(true, row.id)"
              >
                {{ $t('common.edit') }}
              </NButton>
              <NPopconfirm
                :disabled="pending"
                :negative-text="$t('common.cancel')"
                :positive-text="$t('common.delete')"
                :positive-button-props="{ type: 'error' }"
                @positive-click="confirmMutation(true, row, true)"
              >
                <template #trigger>
                  <NButton
                    :disabled="pending"
                    :loading="deletingItemID === row.id"
                    quaternary
                    size="small"
                    type="error"
                  >
                    {{ $t('common.delete') }}
                  </NButton>
                </template>
                {{
                  $t('page.system.dictionary.deleteConfirm', {
                    name: row.label,
                  })
                }}
              </NPopconfirm>
            </NSpace>
          </template>
        </ItemGrid>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.dictionary-empty {
  /* Match the existing small Vxe table empty state, including theme changes. */
  font-size: var(--vxe-ui-font-size-small);
  color: var(--vxe-ui-input-placeholder-color);
  text-align: center;
}
</style>
