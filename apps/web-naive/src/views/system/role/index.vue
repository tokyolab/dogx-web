<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { RoleApi } from '#/api/system';

import { ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import {
  NButton,
  NPopconfirm,
  NSpace,
  NSwitch,
  NTag,
  NTooltip,
} from 'naive-ui';

import { message } from '#/adapter/naive';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteRoleApi,
  listRolesApi,
  SUPER_ADMIN_ROLE_CODE,
  updateRoleStatusApi,
} from '#/api/system';

import APIPermissionModal from './api-permission-modal.vue';
import MenuPermissionModal from './menu-permission-modal.vue';
import RoleFormModal from './role-form-modal.vue';

const statusUpdatingRoleID = ref<number>();
const deletingRoleID = ref<number>();

const [RoleModal, roleModalApi] = useVbenModal({
  connectedComponent: RoleFormModal,
});
const [PermissionModal, permissionModalApi] = useVbenModal({
  connectedComponent: APIPermissionModal,
});

const [MenuModal, menuModalApi] = useVbenModal({
  connectedComponent: MenuPermissionModal,
});

const formOptions = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: $t('page.system.role.keywordPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('page.system.role.keyword'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<RoleApi.RoleItem> = {
  columns: [
    {
      field: 'name',
      minWidth: 140,
      title: $t('page.system.role.name'),
    },
    {
      field: 'code',
      minWidth: 150,
      title: $t('page.system.role.code'),
    },
    {
      field: 'isSystem',
      slots: { default: 'roleType' },
      title: $t('page.system.role.type'),
      width: 100,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('page.system.role.status'),
      width: 100,
    },
    {
      field: 'sort',
      title: $t('page.system.role.sort'),
      width: 90,
    },
    {
      field: 'description',
      minWidth: 180,
      title: $t('page.system.role.description'),
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      minWidth: 170,
      title: $t('page.system.role.createdAt'),
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: $t('page.system.role.operation'),
      width: 390,
    },
  ],
  height: 'auto',
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page }, values) => {
        return await listRolesApi({
          keyword: String(values.keyword ?? '').trim(),
          page: page.currentPage,
          pageSize: page.pageSize,
        });
      },
    },
  },
  rowConfig: {
    keyField: 'id',
  },
  toolbarConfig: {
    search: true,
  },
};

const [Grid, gridApi] = useVbenVxeGrid<RoleApi.RoleItem>({
  formOptions,
  gridOptions,
});

function openCreateModal() {
  roleModalApi
    .setData({
      onSuccess: () => gridApi.reload(),
    })
    .open();
}

function openEditModal(record: RoleApi.RoleItem) {
  roleModalApi
    .setData({
      onSuccess: () => gridApi.reload(),
      record,
    })
    .open();
}

function openPermissionModal(record: RoleApi.RoleItem) {
  if (record.code === SUPER_ADMIN_ROLE_CODE) return;
  permissionModalApi.setData({ record }).open();
}

function confirmStatusUpdate(record: RoleApi.RoleItem) {
  if (record.isSystem || statusUpdatingRoleID.value !== undefined) return false;

  void updateStatus(record).catch(() => undefined);
  return true;
}

function confirmRoleDeletion(record: RoleApi.RoleItem) {
  if (record.isSystem || deletingRoleID.value !== undefined) return false;

  void deleteRole(record).catch(() => undefined);
  return true;
}

async function updateStatus(record: RoleApi.RoleItem) {
  if (record.isSystem || statusUpdatingRoleID.value !== undefined) return false;

  const status = record.status === 1 ? 0 : 1;
  statusUpdatingRoleID.value = record.id;
  try {
    await updateRoleStatusApi({ id: record.id, status });
    message.success(
      status === 1
        ? $t('page.system.role.enableSuccess')
        : $t('page.system.role.disableSuccess'),
    );
    await gridApi.reload();
    return true;
  } finally {
    statusUpdatingRoleID.value = undefined;
  }
}

async function deleteRole(record: RoleApi.RoleItem) {
  if (record.isSystem || deletingRoleID.value !== undefined) return false;

  deletingRoleID.value = record.id;
  try {
    await deleteRoleApi(record.id);
    message.success($t('page.system.role.deleteSuccess'));
    await gridApi.reload();
    return true;
  } finally {
    deletingRoleID.value = undefined;
  }
}
</script>

<template>
  <Page auto-content-height>
    <RoleModal />
    <PermissionModal />
    <MenuModal />

    <Grid>
      <template #toolbar-actions>
        <NButton type="primary" @click="openCreateModal">
          {{ $t('page.system.role.createTitle') }}
        </NButton>
      </template>

      <template #roleType="{ row }">
        <NTag
          :bordered="false"
          :type="row.isSystem ? 'info' : 'default'"
          size="small"
        >
          {{
            row.isSystem
              ? $t('page.system.role.systemRole')
              : $t('page.system.role.customRole')
          }}
        </NTag>
      </template>

      <template #status="{ row }">
        <NTooltip v-if="row.isSystem">
          <template #trigger>
            <NSwitch :value="row.status === 1" disabled />
          </template>
          {{ $t('page.system.role.systemStatusHelp') }}
        </NTooltip>
        <NPopconfirm
          v-else
          :negative-text="$t('common.cancel')"
          :positive-text="$t('common.confirm')"
          @positive-click="confirmStatusUpdate(row)"
        >
          <template #trigger>
            <NSwitch
              :loading="statusUpdatingRoleID === row.id"
              :value="row.status === 1"
            />
          </template>
          {{
            row.status === 1
              ? $t('page.system.role.disableConfirm', { name: row.name })
              : $t('page.system.role.enableConfirm', { name: row.name })
          }}
        </NPopconfirm>
      </template>

      <template #operation="{ row }">
        <NSpace :size="4" justify="center">
          <NButton
            quaternary
            size="small"
            type="primary"
            @click="openEditModal(row)"
          >
            {{ $t('common.edit') }}
          </NButton>

          <NTooltip
            :disabled="row.status === 1 && row.code !== SUPER_ADMIN_ROLE_CODE"
          >
            <template #trigger>
              <span>
                <NButton
                  :disabled="
                    row.status !== 1 || row.code === SUPER_ADMIN_ROLE_CODE
                  "
                  quaternary
                  size="small"
                  type="primary"
                  @click="openPermissionModal(row)"
                >
                  {{
                    row.code === SUPER_ADMIN_ROLE_CODE
                      ? $t('page.system.role.superAdminPermissionLabel')
                      : $t('page.system.role.apiPermission')
                  }}
                </NButton>
              </span>
            </template>
            {{
              row.code === SUPER_ADMIN_ROLE_CODE
                ? $t('page.system.role.superAdminPermissionHelp')
                : $t('page.system.role.disabledPermissionHelp')
            }}
          </NTooltip>

          <NTooltip
            :disabled="row.status === 1 && row.code !== SUPER_ADMIN_ROLE_CODE"
          >
            <template #trigger>
              <span>
                <NButton
                  :disabled="
                    row.status !== 1 || row.code === SUPER_ADMIN_ROLE_CODE
                  "
                  quaternary
                  size="small"
                  type="primary"
                  @click="menuModalApi.setData({ record: row }).open()"
                >
                  {{
                    row.code === SUPER_ADMIN_ROLE_CODE
                      ? $t('page.system.role.allMenus')
                      : $t('page.system.role.menuPermission')
                  }}
                </NButton>
              </span>
            </template>
            {{
              row.code === SUPER_ADMIN_ROLE_CODE
                ? $t('page.system.role.superAdminMenuHelp')
                : $t('page.system.role.disabledMenuHelp')
            }}
          </NTooltip>
          <NTooltip :disabled="!row.isSystem">
            <template #trigger>
              <span>
                <NPopconfirm
                  :disabled="row.isSystem"
                  :negative-text="$t('common.cancel')"
                  :positive-button-props="{ type: 'error' }"
                  :positive-text="$t('common.delete')"
                  @positive-click="confirmRoleDeletion(row)"
                >
                  <template #trigger>
                    <NButton
                      :disabled="row.isSystem"
                      :loading="deletingRoleID === row.id"
                      quaternary
                      size="small"
                      type="error"
                    >
                      {{ $t('common.delete') }}
                    </NButton>
                  </template>
                  {{ $t('page.system.role.deleteConfirm', { name: row.name }) }}
                </NPopconfirm>
              </span>
            </template>
            {{ $t('page.system.role.systemDeleteHelp') }}
          </NTooltip>
        </NSpace>
      </template>
    </Grid>
  </Page>
</template>
