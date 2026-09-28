import type { VbenFormSchema } from '#/adapter/form';

import { $t } from '@vben/locales';

import { z } from '#/adapter/form';

export interface DictionaryFormValues {
  name?: string;
  code?: string;
  isPublic?: boolean;
  label?: string;
  value?: string;
  sort?: number;
  remark?: string;
  status?: number;
}
export function dictionarySnapshot(
  values: DictionaryFormValues,
  item: boolean,
  editing: boolean,
) {
  return JSON.stringify({
    ...(item
      ? {
          label: values.label?.trim() ?? '',
          sort: values.sort ?? 0,
          ...(editing ? {} : { value: values.value?.trim() ?? '' }),
        }
      : {
          name: values.name?.trim() ?? '',
          isPublic: values.isPublic ?? false,
          ...(editing ? {} : { code: values.code ?? '' }),
        }),
    remark: values.remark?.trim() ?? '',
    ...(editing ? {} : { status: values.status ?? 1 }),
  });
}
export function dictionaryFormSchema(
  item: boolean,
  editing: boolean,
): VbenFormSchema[] {
  const t = (key: string) => $t(`page.system.dictionary.${key}`);
  const text = (fieldName: string, max: number): VbenFormSchema => ({
    component: 'Input',
    fieldName,
    label: t(fieldName),
    componentProps: {
      maxlength: max,
      placeholder: t(`${fieldName}Placeholder`),
    },
    rules: z
      .string({
        required_error: t(`${fieldName}Required`),
        invalid_type_error: t(`${fieldName}Required`),
      })
      .trim()
      .min(1, t(`${fieldName}Required`))
      .max(max, t(`${fieldName}TooLong`)),
  });
  const schema: VbenFormSchema[] = [text(item ? 'label' : 'name', 128)];
  if (!editing) {
    const identity = text(item ? 'value' : 'code', item ? 128 : 64);
    if (!item)
      identity.rules = z
        .string({
          required_error: t('codeRequired'),
          invalid_type_error: t('codeRequired'),
        })
        .min(1, t('codeRequired'))
        .max(64, t('codeTooLong'))
        .regex(/^[a-z][a-z0-9_-]*$/, t('codeRule'));
    schema.push(identity);
  }
  if (item)
    schema.push({
      component: 'InputNumber',
      fieldName: 'sort',
      label: t('sort'),
      help: t('sortHelp'),
      defaultValue: 0,
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
        .max(2_147_483_647, t('sortTooLarge')),
    });
  else
    schema.push({
      component: 'Switch',
      fieldName: 'isPublic',
      label: t('isPublic'),
      componentProps: { class: 'w-auto' },
      defaultValue: false,
      rules: z.boolean(),
      help: t('publicHelp'),
    });
  if (!editing)
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
      rules: z.number().int().min(0).max(1),
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
