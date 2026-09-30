<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { LoginLogApi } from '#/api/system/login-log';

import { Page } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { NTag } from 'naive-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listLoginLogsApi } from '#/api/system/login-log';

const formOptions = {
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        maxlength: 64,
        placeholder: $t('page.system.loginLog.usernamePlaceholder'),
      },
      fieldName: 'username',
      label: $t('page.system.loginLog.username'),
    },
    {
      component: 'Select',
      componentProps: {
        clearable: true,
        options: [
          { label: $t('page.system.loginLog.success'), value: 'success' },
          { label: $t('page.system.loginLog.failure'), value: 'failure' },
        ],
        placeholder: $t('common.all'),
      },
      fieldName: 'result',
      label: $t('page.system.loginLog.result'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<LoginLogApi.Item> = {
  columns: [
    {
      field: 'username',
      minWidth: 150,
      title: $t('page.system.loginLog.username'),
    },
    {
      field: 'ipAddress',
      minWidth: 150,
      title: $t('page.system.loginLog.ipAddress'),
    },
    {
      field: 'success',
      slots: { default: 'result' },
      title: $t('page.system.loginLog.result'),
      width: 100,
    },
    {
      field: 'failureReason',
      formatter: ({ row }) => resultDescription(row),
      minWidth: 180,
      title: $t('page.system.loginLog.detail'),
    },
    {
      field: 'userAgent',
      minWidth: 220,
      title: $t('page.system.loginLog.userAgent'),
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      minWidth: 180,
      title: $t('page.system.loginLog.createdAt'),
    },
  ],
  height: 'auto',
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page }, values) => {
        return await listLoginLogsApi({
          page: page.currentPage,
          pageSize: page.pageSize,
          result: values.result || undefined,
          username: String(values.username ?? '').trim(),
        });
      },
    },
  },
  rowConfig: { keyField: 'id' },
  toolbarConfig: { search: true },
};

const [Grid] = useVbenVxeGrid<LoginLogApi.Item>({ formOptions, gridOptions });

function resultDescription(row: LoginLogApi.Item) {
  if (row.success) return $t('page.system.loginLog.loginSuccess');
  switch (row.failureReason) {
    case 'account_disabled': {
      return $t('page.system.loginLog.accountDisabled');
    }
    case 'invalid_credentials': {
      return $t('page.system.loginLog.invalidCredentials');
    }
    case 'system_error': {
      return $t('page.system.loginLog.systemError');
    }
    default: {
      return row.failureReason;
    }
  }
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #result="{ row }">
        <NTag
          :bordered="false"
          :type="row.success ? 'success' : 'error'"
          size="small"
        >
          {{
            $t(
              row.success
                ? 'page.system.loginLog.success'
                : 'page.system.loginLog.failure',
            )
          }}
        </NTag>
      </template>
    </Grid>
  </Page>
</template>
