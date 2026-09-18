<script lang="ts" setup>
import type { DropdownOption } from 'naive-ui';

import type { VNode } from 'vue';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { UserApi } from '#/api/system';

import { h, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { ChevronDown } from '@vben/icons';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import {
  NButton,
  NDropdown,
  NPopconfirm,
  NSpace,
  NSwitch,
  NTooltip,
} from 'naive-ui';

import { dialog, message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteUserApi, listUsersApi, updateUserStatusApi } from '#/api/system';

import { userActionAvailability } from './user-form';
import UserFormModal from './user-form-modal.vue';
import UserPasswordModal from './user-password-modal.vue';
import UserRoleTags from './user-role-tags.vue';
import UserRolesModal from './user-roles-modal.vue';

const userStore = useUserStore();
const statusID = ref<number>();
const deletingID = ref<number>();
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: UserFormModal,
});
const [RolesModal, rolesModalApi] = useVbenModal({
  connectedComponent: UserRolesModal,
});
const [PasswordModal, passwordModalApi] = useVbenModal({
  connectedComponent: UserPasswordModal,
});

const gridOptions: VxeTableGridOptions<UserApi.UserItem> = {
  columns: [
    {
      field: 'username',
      minWidth: 150,
      title: $t('page.system.user.username'),
    },
    {
      field: 'nickname',
      minWidth: 140,
      title: $t('page.system.user.nickname'),
    },
    {
      field: 'roles',
      minWidth: 180,
      // The role tags provide their own hover details instead of VXE's tooltip.
      showOverflow: 'ellipsis',
      slots: { default: 'roles' },
      title: $t('page.system.user.roles'),
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('page.system.user.status'),
      width: 100,
    },
    { field: 'email', minWidth: 180, title: $t('page.system.user.email') },
    { field: 'phone', minWidth: 140, title: $t('page.system.user.phone') },
    {
      field: 'lastLoginAt',
      formatter: ({ cellValue }) =>
        cellValue ? formatDateTime(cellValue) : '',
      minWidth: 180,
      title: $t('page.system.user.lastLoginAt'),
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      minWidth: 180,
      title: $t('page.system.user.createdAt'),
    },
    {
      field: 'operation',
      fixed: 'right',
      minWidth: 280,
      slots: { default: 'operation' },
      title: $t('page.system.role.operation'),
      width: 280,
    },
  ],
  height: 'auto',
  pagerConfig: {},
  rowConfig: { keyField: 'id' },
  toolbarConfig: { search: true },
  proxyConfig: {
    ajax: {
      query: async ({ page }, values) =>
        listUsersApi({
          keyword: String(values.keyword ?? '').trim(),
          page: page.currentPage,
          pageSize: page.pageSize,
          status:
            values.status === 0 || values.status === 1
              ? values.status
              : undefined,
        }),
    },
  },
};
const [Grid, gridApi] = useVbenVxeGrid<UserApi.UserItem>({
  gridOptions,
  formOptions: {
    schema: [
      {
        component: 'Input',
        componentProps: {
          clearable: true,
          placeholder: $t('page.system.user.keywordPlaceholder'),
        },
        fieldName: 'keyword',
        label: $t('page.system.user.keyword'),
      },
      {
        component: 'Select',
        componentProps: {
          clearable: true,
          options: [
            { label: $t('common.enabled'), value: 1 },
            { label: $t('common.disabled'), value: 0 },
          ],
          placeholder: $t('page.system.user.allStatuses'),
        },
        fieldName: 'status',
        label: $t('page.system.user.status'),
      },
    ],
    showCollapseButton: false,
    submitOnEnter: true,
  },
});

function openUser(id?: number) {
  formModalApi.setData({ id, onSuccess: () => gridApi.reload() }).open();
}
function openRoles(id: number) {
  rolesModalApi.setData({ id, onSuccess: () => gridApi.reload() }).open();
}
function actions(record: UserApi.UserItem) {
  return userActionAvailability(record, Number(userStore.userInfo?.userId));
}

function moreOptions(record: UserApi.UserItem): DropdownOption[] {
  const availability = actions(record);
  const deleteDisabled =
    !availability.canDeactivate || deletingID.value !== undefined;
  return [
    {
      disabled: !availability.canManage || deletingID.value === record.id,
      key: 'reset-password',
      label: $t('page.system.user.resetPassword'),
    },
    {
      disabled: deleteDisabled,
      key: 'delete',
      label: () =>
        h(
          'span',
          { class: deleteDisabled ? undefined : 'text-destructive' },
          $t('common.delete'),
        ),
    },
  ];
}

function renderMoreOption(
  record: UserApi.UserItem,
  { node, option }: { node: VNode; option: DropdownOption },
) {
  const availability = actions(record);
  if (option.key !== 'delete' || availability.canDeactivate) return node;

  return h(
    NTooltip,
    { placement: 'left' },
    {
      default: () =>
        $t(
          availability.canAssignRoles
            ? 'page.system.user.selfDeleteHelp'
            : 'page.system.user.superAdminDeleteHelp',
        ),
      trigger: () => node,
    },
  );
}

function onMoreSelect(key: number | string, record: UserApi.UserItem) {
  if (deletingID.value === record.id) return;
  if (key === 'reset-password' && actions(record).canManage) {
    passwordModalApi
      .setData({ id: record.id, nickname: record.nickname })
      .open();
  } else if (
    key === 'delete' &&
    actions(record).canDeactivate &&
    deletingID.value === undefined
  ) {
    dialog.warning({
      content: $t('page.system.user.deleteConfirm', { name: record.nickname }),
      negativeText: $t('common.cancel'),
      onPositiveClick: () => confirmDelete(record),
      positiveButtonProps: { type: 'error' },
      positiveText: $t('common.delete'),
      title: $t('common.delete'),
    });
  }
}

function confirmStatus(record: UserApi.UserItem) {
  if (!actions(record).canDeactivate || statusID.value !== undefined)
    return false;
  void changeStatus(record).catch(() => undefined);
  return true;
}
async function changeStatus(record: UserApi.UserItem) {
  const status = record.status === 1 ? 0 : 1;
  statusID.value = record.id;
  try {
    await updateUserStatusApi(record.id, status);
    message.success(
      $t(status === 1 ? 'common.enableSuccess' : 'common.disableSuccess'),
    );
    await gridApi.reload();
  } finally {
    statusID.value = undefined;
  }
}
function confirmDelete(record: UserApi.UserItem) {
  if (!actions(record).canDeactivate || deletingID.value !== undefined)
    return false;
  void removeUser(record).catch(() => undefined);
  return true;
}
async function removeUser(record: UserApi.UserItem) {
  deletingID.value = record.id;
  try {
    await deleteUserApi(record.id);
    message.success($t('common.deleteSuccess'));
    await gridApi.reload();
  } finally {
    deletingID.value = undefined;
  }
}
</script>

<template>
  <Page auto-content-height>
    <FormModal /><RolesModal /><PasswordModal />
    <Grid>
      <template #toolbar-actions>
        <NButton type="primary" @click="openUser()">
          {{ $t('page.system.user.createTitle') }}
        </NButton>
      </template>
      <template #roles="{ row }">
        <UserRoleTags :roles="row.roles" />
      </template>
      <template #status="{ row }">
        <NTooltip v-if="!actions(row).canDeactivate">
          <template #trigger>
            <NSwitch :value="row.status === 1" disabled />
          </template>
          {{
            $t(
              actions(row).canAssignRoles
                ? 'page.system.user.selfStatusHelp'
                : 'page.system.user.superAdminStatusHelp',
            )
          }}
        </NTooltip>
        <NPopconfirm
          v-else
          :disabled="statusID !== undefined"
          :negative-text="$t('common.cancel')"
          :positive-text="$t('common.confirm')"
          @positive-click="confirmStatus(row)"
        >
          <template #trigger>
            <NSwitch
              :disabled="statusID !== undefined"
              :loading="statusID === row.id"
              :value="row.status === 1"
            />
          </template>
          {{
            $t(
              row.status === 1
                ? 'page.system.user.disableConfirm'
                : 'page.system.user.enableConfirm',
              { name: row.nickname },
            )
          }}
        </NPopconfirm>
      </template>
      <template #operation="{ row }">
        <NSpace :size="4" :wrap="false" justify="center">
          <NTooltip :disabled="actions(row).canManage">
            <template #trigger>
              <span>
                <NButton
                  :disabled="!actions(row).canManage"
                  quaternary
                  size="small"
                  type="primary"
                  @click="openUser(row.id)"
                >
                  {{ $t('common.edit') }}
                </NButton>
              </span>
            </template>
            {{ $t('page.system.user.superAdminManageHelp') }}
          </NTooltip>
          <NTooltip :disabled="actions(row).canAssignRoles">
            <template #trigger>
              <span>
                <NButton
                  :disabled="!actions(row).canAssignRoles"
                  quaternary
                  size="small"
                  type="primary"
                  @click="openRoles(row.id)"
                >
                  {{ $t('page.system.user.assignRoles') }}
                </NButton>
              </span>
            </template>
            {{ $t('page.system.user.superAdminRolesHelp') }}
          </NTooltip>
          <NTooltip :disabled="actions(row).canManage">
            <template #trigger>
              <span>
                <NDropdown
                  :disabled="!actions(row).canManage || deletingID === row.id"
                  :options="moreOptions(row)"
                  :render-option="(info) => renderMoreOption(row, info)"
                  trigger="click"
                  @select="(key) => onMoreSelect(key, row)"
                >
                  <NButton
                    :disabled="!actions(row).canManage || deletingID === row.id"
                    :loading="deletingID === row.id"
                    quaternary
                    size="small"
                    type="primary"
                  >
                    {{ $t('page.system.user.more') }}
                    <ChevronDown class="ml-1 size-3" />
                  </NButton>
                </NDropdown>
              </span>
            </template>
            {{ $t('page.system.user.superAdminManageHelp') }}
          </NTooltip>
        </NSpace>
      </template>
    </Grid>
  </Page>
</template>
