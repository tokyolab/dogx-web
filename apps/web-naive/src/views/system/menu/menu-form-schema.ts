import type { VbenFormSchema } from '#/adapter/form';
import type { MenuApi } from '#/api/system/menu';

import { $t } from '@vben/locales';

import { z } from '#/adapter/form';

import { validMenuPath } from './menu-form';
import { menuParentOptions } from './menu-tree';

export function menuFormSchema(
  items: MenuApi.Item[],
  currentID?: number,
): VbenFormSchema[] {
  const t = (key: string) => $t(`page.system.menu.${key}`);
  const text = (key: string, max: number, required = false) => {
    const rule = z
      .string()
      .trim()
      .max(max, { message: $t('page.system.menu.tooLong', { max }) });
    return required
      ? rule.min(1, {
          message: $t('page.system.menu.required', { field: t(key) }),
        })
      : rule;
  };
  const input = (key: string, max: number): VbenFormSchema => ({
    component: 'Input',
    componentProps: { maxlength: max, placeholder: t(`${key}Placeholder`) },
    fieldName: key,
    label: t(key),
    rules: text(key, max).optional(),
  });
  const radio = (
    key: string,
    options: { label: string; value: number }[],
    defaultValue: number,
  ): VbenFormSchema => ({
    component: 'RadioGroup',
    componentProps: { isButton: true, options },
    defaultValue,
    fieldName: key,
    label: t(key),
    rules: z.number(),
  });
  const pageOnly = {
    triggerFields: ['type'],
    show: (v: Record<string, unknown>) => v.type === 2,
  };
  const routed = {
    triggerFields: ['type'],
    show: (v: Record<string, unknown>) => v.type !== 3,
  };
  const yesNo = [
    { label: t('yes'), value: 1 },
    { label: t('no'), value: 0 },
  ];
  const schema: VbenFormSchema[] = [
    radio(
      'type',
      [
        { value: 1, label: t('directory') },
        { value: 2, label: t('page') },
        { value: 3, label: t('element') },
      ],
      1,
    ),
    {
      component: 'TreeSelect',
      componentProps: {
        options: menuParentOptions(items, t('root'), currentID),
        clearable: false,
        filterable: true,
        placeholder: t('parentPlaceholder'),
      },
      fieldName: 'parentId',
      label: t('parentId'),
      defaultValue: 0,
      dependencies: {
        triggerFields: ['type'],
        rules: (v) =>
          z
            .number()
            .int()
            .min(v.type === 3 ? 1 : 0, { message: t('elementParentRequired') }),
      },
    },
    { ...input('name', 64), rules: text('name', 64, true) },
    {
      ...input('routeName', 128),
      help: t('routeNameHelp'),
      dependencies: {
        ...routed,
        rules: (v) =>
          v.type === 3
            ? z.any()
            : text('routeName', 128, true).regex(
                /^[A-Za-z][A-Za-z0-9_]*$/,
                t('routeNameInvalid'),
              ),
      },
    },
    { ...radio('external', yesNo, 0), dependencies: pageOnly },
    {
      ...input('path', 255),
      help: t('pathHelp'),
      dependencies: {
        triggerFields: ['type', 'external'],
        show: (v) => v.type !== 3,
        rules: (v) =>
          v.type === 3
            ? z.any()
            : text('path', 255, true).refine(
                (value) =>
                  validMenuPath(value, v.type === 2 && v.external === 1),
                t('pathInvalid'),
              ),
      },
    },
    {
      ...input('component', 255),
      help: t('componentHelp'),
      dependencies: {
        triggerFields: ['type', 'external'],
        show: (v) => v.type === 2 && v.external !== 1,
        rules: (v) =>
          v.type === 2 && v.external !== 1
            ? text('component', 255, true).regex(
                /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/,
                t('componentInvalid'),
              )
            : z.any(),
      },
    },
    {
      ...input('permission', 128),
      help: t('permissionHelp'),
      dependencies: {
        triggerFields: ['type'],
        show: (v) => v.type === 3,
        rules: (v) =>
          v.type === 3
            ? text('permission', 128, true).refine(
                (value) => !/\s/.test(value),
                t('permissionInvalid'),
              )
            : z.any(),
      },
    },
    {
      component: 'IconPicker',
      componentProps: { placeholder: t('iconPlaceholder') },
      fieldName: 'icon',
      label: t('icon'),
      dependencies: routed,
    },
    {
      ...radio(
        'visible',
        [
          { label: t('shown'), value: 1 },
          { label: t('hidden'), value: 0 },
        ],
        1,
      ),
      help: t('visibleHelp'),
      dependencies: routed,
    },
    {
      ...radio('keepAlive', yesNo, 0),
      dependencies: {
        triggerFields: ['type', 'external'],
        show: (v) => v.type === 2 && v.external !== 1,
      },
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        max: 2_147_483_647,
        placeholder: t('sortPlaceholder'),
      },
      fieldName: 'sort',
      label: t('sort'),
      help: t('sortHelp'),
      defaultValue: 0,
      rules: z
        .number({
          invalid_type_error: t('sortRequired'),
          required_error: t('sortRequired'),
        })
        .int(t('sortInvalid'))
        .min(0, t('sortInvalid'))
        .max(2_147_483_647, t('sortInvalid')),
    },
  ];
  if (!currentID)
    schema.push(
      radio(
        'status',
        [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        1,
      ),
    );
  schema.push({
    ...input('remark', 500),
    componentProps: {
      type: 'textarea',
      autosize: { minRows: 3, maxRows: 5 },
      maxlength: 500,
      showCount: true,
      placeholder: t('remarkPlaceholder'),
    },
  });
  return schema;
}
