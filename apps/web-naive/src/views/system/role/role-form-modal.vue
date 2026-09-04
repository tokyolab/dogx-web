<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { RoleApi } from '#/api/system';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useVbenForm, z } from '#/adapter/form';
import { dialog, message } from '#/adapter/naive';
import {
  createRoleApi,
  SUPER_ADMIN_ROLE_CODE,
  updateRoleApi,
} from '#/api/system';

interface RoleFormModalData {
  onSuccess?: () => Promise<void> | void;
  record?: RoleApi.RoleItem;
}

interface RoleFormValues {
  code: string;
  description: string;
  name: string;
  sort: number;
  status?: number;
}

const currentRecord = ref<RoleApi.RoleItem>();
const initialSnapshot = ref('');

function createSchema(isUpdate: boolean, isSystem: boolean): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      component: 'Input',
      componentProps: {
        disabled: isUpdate && isSystem,
        maxlength: 64,
        placeholder: $t('page.system.role.codePlaceholder'),
        showCount: true,
      },
      fieldName: 'code',
      help:
        isUpdate && isSystem
          ? $t('page.system.role.systemCodeHelp')
          : $t('page.system.role.codeHelp'),
      label: $t('page.system.role.code'),
      rules: z
        .string()
        .min(1, { message: $t('page.system.role.codeRequired') })
        .max(64, { message: $t('page.system.role.codeTooLong') })
        .refine((value) => /^[a-z][a-z0-9_]*$/.test(value), {
          message: $t('page.system.role.codeInvalid'),
        })
        .refine(
          (value) => (isUpdate && isSystem) || value !== SUPER_ADMIN_ROLE_CODE,
          {
            message: $t('page.system.role.codeReserved'),
          },
        ),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: $t('page.system.role.namePlaceholder'),
        showCount: true,
      },
      fieldName: 'name',
      label: $t('page.system.role.name'),
      rules: z
        .string()
        .trim()
        .min(1, { message: $t('page.system.role.nameRequired') })
        .max(64, { message: $t('page.system.role.nameTooLong') }),
    },
    {
      component: 'Input',
      componentProps: {
        autosize: { maxRows: 5, minRows: 3 },
        maxlength: 500,
        placeholder: $t('page.system.role.descriptionPlaceholder'),
        showCount: true,
        type: 'textarea',
      },
      fieldName: 'description',
      label: $t('page.system.role.description'),
      rules: z
        .string()
        .max(500, { message: $t('page.system.role.descriptionTooLong') })
        .optional(),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 2_147_483_647,
        min: 0,
        placeholder: $t('page.system.role.sortPlaceholder'),
      },
      defaultValue: 0,
      fieldName: 'sort',
      help: $t('page.system.role.sortHelp'),
      label: $t('page.system.role.sort'),
      rules: z
        .number({
          invalid_type_error: $t('page.system.role.sortRequired'),
          required_error: $t('page.system.role.sortRequired'),
        })
        .int({ message: $t('page.system.role.sortInvalid') })
        .min(0, { message: $t('page.system.role.sortInvalid') }),
    },
  ];

  if (!isUpdate) {
    schema.push({
      component: 'RadioGroup',
      componentProps: {
        isButton: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('page.system.role.status'),
      rules: z.number(),
    });
  }

  return schema;
}

function toSnapshot(values: RoleFormValues) {
  return JSON.stringify({
    code: values.code?.trim() ?? '',
    description: values.description?.trim() ?? '',
    name: values.name?.trim() ?? '',
    sort: values.sort ?? 0,
    status: values.status,
  });
}

async function confirmDiscardChanges() {
  if (!initialSnapshot.value) return true;
  const values = await formApi.getValues<RoleFormValues>();
  if (toSnapshot(values) === initialSnapshot.value) return true;

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    dialog.warning({
      content: $t('page.system.role.discardChangesContent'),
      maskClosable: false,
      negativeText: $t('common.cancel'),
      onClose: () => finish(false),
      onNegativeClick: () => finish(false),
      onPositiveClick: () => finish(true),
      positiveText: $t('page.system.role.discardChanges'),
      title: $t('page.system.role.discardChangesTitle'),
    });
  });
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
  },
  layout: 'vertical',
  schema: createSchema(false, false),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Modal, modalApi] = useVbenModal({
  fullscreenButton: false,
  onBeforeClose: confirmDiscardChanges,
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    const validation = await formApi.validate();
    if (!validation.valid) return;

    const values = await formApi.getValues<RoleFormValues>();
    const data = modalApi.getData<RoleFormModalData>();
    modalApi.lock();
    try {
      if (currentRecord.value) {
        await updateRoleApi({
          code: values.code.trim(),
          description: values.description.trim(),
          id: currentRecord.value.id,
          name: values.name.trim(),
          sort: values.sort,
        });
        message.success($t('page.system.role.updateSuccess'));
      } else {
        await createRoleApi({
          code: values.code.trim(),
          description: values.description.trim(),
          name: values.name.trim(),
          sort: values.sort,
          status: values.status ?? 1,
        });
        message.success($t('page.system.role.createSuccess'));
      }
      initialSnapshot.value = toSnapshot(values);
      await data?.onSuccess?.();
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) {
      currentRecord.value = undefined;
      initialSnapshot.value = '';
      return;
    }

    const record = modalApi.getData<RoleFormModalData>()?.record;
    currentRecord.value = record;
    formApi.setState({
      schema: createSchema(Boolean(record), !!record?.isSystem),
    });
    modalApi.setState({
      title: record
        ? $t('page.system.role.editTitle')
        : $t('page.system.role.createTitle'),
    });

    await nextTick();
    await formApi.resetForm();
    const values: RoleFormValues = record
      ? {
          code: record.code,
          description: record.description,
          name: record.name,
          sort: record.sort,
        }
      : {
          code: '',
          description: '',
          name: '',
          sort: 0,
          status: 1,
        };
    await formApi.setValues(values);
    initialSnapshot.value = toSnapshot(values);
  },
});

defineExpose(modalApi);
</script>

<template>
  <Modal>
    <Form />
  </Modal>
</template>
