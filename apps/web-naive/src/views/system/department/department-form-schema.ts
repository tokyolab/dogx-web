import type { VbenFormSchema } from '#/adapter/form';
import type { DepartmentApi } from '#/api/system/department';

import { $t } from '@vben/locales';

import { z } from '#/adapter/form';

import { departmentParentOptions } from './department-tree';

export function departmentFormSchema(
  items: DepartmentApi.Item[],
  currentID?: number,
): VbenFormSchema[] {
  const t = (key: string) => $t(`page.system.department.${key}`);
  const schema: VbenFormSchema[] = [
    {
      component: 'TreeSelect',
      fieldName: 'parentId',
      label: t('parentId'),
      defaultValue: 0,
      componentProps: {
        options: departmentParentOptions(items, t('root'), currentID),
        clearable: false,
        filterable: true,
        placeholder: t('parentPlaceholder'),
      },
      rules: z.number().int().min(0),
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: t('name'),
      componentProps: { maxlength: 128, placeholder: t('namePlaceholder') },
      rules: z
        .string()
        .trim()
        .min(1, t('nameRequired'))
        .max(128, t('nameTooLong')),
    },
    {
      component: 'InputNumber',
      fieldName: 'sort',
      label: t('sort'),
      defaultValue: 0,
      help: t('sortHelp'),
      componentProps: {
        min: 0,
        max: 2_147_483_647,
        placeholder: t('sortPlaceholder'),
      },
      rules: z
        .number({
          required_error: t('sortRequired'),
          invalid_type_error: t('sortRequired'),
        })
        .int(t('sortInvalid'))
        .min(0, t('sortInvalid'))
        .max(2_147_483_647, t('sortInvalid')),
    },
  ];
  if (!currentID)
    schema.push({
      component: 'RadioGroup',
      fieldName: 'status',
      label: t('status'),
      defaultValue: 1,
      componentProps: {
        isButton: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      rules: z.number(),
    });
  schema.push({
    component: 'Input',
    fieldName: 'remark',
    label: t('remark'),
    componentProps: {
      type: 'textarea',
      autosize: { minRows: 3, maxRows: 5 },
      maxlength: 500,
      showCount: true,
      placeholder: t('remarkPlaceholder'),
    },
    rules: z.string().max(500, t('remarkTooLong')).optional(),
  });
  return schema;
}
