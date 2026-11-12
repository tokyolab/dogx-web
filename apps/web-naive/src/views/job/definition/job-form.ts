import type { VbenFormSchema } from '#/adapter/form';
import type { JobDefinitionApi } from '#/api/job/definition';

import { markRaw } from 'vue';

import { $t } from '@vben/locales';

import { z } from '#/adapter/form';

import GroupSelect from '../group/group-select.vue';
import CronInput from './cron-input.vue';

export function defaultJobInput(): JobDefinitionApi.Input {
  return {
    name: '',
    remark: '',
    executorGroupId: 0,
    processorName: '',
    executionMode: 1,
    postEnabled: false,
    params: '',
    cronExpr: '',
    misfirePolicy: 0,
    blockPolicy: 0,
    maxRetries: 3,
    retryIntervalSeconds: 10,
    timeoutSeconds: 900,
  };
}
export function normalizeJobInput(
  values: JobDefinitionApi.Input,
): JobDefinitionApi.Input {
  return {
    name: values.name?.trim() ?? '',
    remark: values.remark?.trim() ?? '',
    executorGroupId: values.executorGroupId,
    processorName: values.processorName?.trim() ?? '',
    executionMode: values.executionMode,
    postEnabled: values.executionMode === 2 && !!values.postEnabled,
    params: values.params?.trim() ?? '',
    cronExpr: values.cronExpr?.trim() ?? '',
    misfirePolicy: values.misfirePolicy,
    blockPolicy: values.blockPolicy,
    maxRetries: values.maxRetries,
    retryIntervalSeconds: values.retryIntervalSeconds,
    timeoutSeconds: values.timeoutSeconds,
  };
}
export function jobFormSchema(): VbenFormSchema[] {
  const label = (field: string) => $t(`job-management.${field}`);
  const required = (field: string) =>
    $t('ui.formRules.required', [label(field)]);
  const selected = (field: string) =>
    $t('ui.formRules.selectRequired', [label(field)]);
  const requiredText = (field: string, max: number) =>
    z
      .string({
        required_error: required(field),
        invalid_type_error: required(field),
      })
      .trim()
      .min(1, required(field))
      .max(max, $t('ui.formRules.maxLength', [label(field), max]));
  const text = (
    fieldName: string,
    max: number,
    help?: string,
  ): VbenFormSchema => ({
    component: 'Input',
    fieldName,
    label: label(fieldName),
    help: help ? $t(`job-management.${help}`) : undefined,
    componentProps: { maxlength: max, placeholder: required(fieldName) },
    rules: requiredText(fieldName, max),
  });
  const number = (
    fieldName: string,
    min: number,
    help: string,
  ): VbenFormSchema => {
    const max = 2_147_483_647;
    const invalid = $t('job-management.integerRange', { min, max });
    return {
      component: 'InputNumber',
      fieldName,
      label: label(fieldName),
      help: $t(`job-management.${help}`),
      componentProps: { min, max, precision: 0 },
      rules: z
        .number({
          required_error: required(fieldName),
          invalid_type_error: required(fieldName),
        })
        .int(invalid)
        .min(min, invalid)
        .max(max, invalid),
    };
  };
  const select = (
    fieldName: string,
    options: [number, string][],
  ): VbenFormSchema => ({
    component: 'Select',
    fieldName,
    label: $t(`job-management.${fieldName}`),
    componentProps: {
      options: options.map(([value, key]) => ({
        value,
        label: $t(`job-management.${key}`),
      })),
    },
    rules: z.number({
      required_error: selected(fieldName),
      invalid_type_error: selected(fieldName),
    }),
  });
  return [
    text('name', 128),
    {
      component: markRaw(GroupSelect),
      fieldName: 'executorGroupId',
      label: $t('job-management.executorGroupId'),
      rules: z
        .number({
          required_error: selected('executorGroupId'),
          invalid_type_error: selected('executorGroupId'),
        })
        .int(selected('executorGroupId'))
        .positive(selected('executorGroupId')),
    },
    text('processorName', 128, 'processorHelp'),
    select('executionMode', [
      [1, 'ordinary'],
      [2, 'sharded'],
    ]),
    {
      component: 'Switch',
      fieldName: 'postEnabled',
      label: $t('job-management.postEnabled'),
      help: $t('job-management.postHelp'),
      dependencies: {
        triggerFields: ['executionMode'],
        show: (values) => values.executionMode === 2,
      },
    },
    {
      component: markRaw(CronInput),
      fieldName: 'cronExpr',
      modelPropName: 'value',
      label: $t('job-management.cronExpr'),
      help: $t('job-management.cronHelp'),
      rules: requiredText('cronExpr', 128),
    },
    {
      component: 'Input',
      fieldName: 'params',
      label: $t('job-management.params'),
      help: $t('job-management.paramsHelp'),
      componentProps: {
        type: 'textarea',
        autosize: { minRows: 3, maxRows: 8 },
      },
    },
    select('misfirePolicy', [
      [0, 'misfireIgnore'],
      [1, 'misfireOnce'],
    ]),
    select('blockPolicy', [
      [0, 'blockDiscard'],
      [1, 'blockParallel'],
    ]),
    number('maxRetries', 0, 'retryHelp'),
    number('retryIntervalSeconds', 1, 'secondsHelp'),
    number('timeoutSeconds', 1, 'timeoutHelp'),
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('job-management.remark'),
      componentProps: {
        type: 'textarea',
        maxlength: 500,
        autosize: { minRows: 2, maxRows: 4 },
      },
      rules: z
        .string({ invalid_type_error: required('remark') })
        .max(500, $t('ui.formRules.maxLength', [label('remark'), 500]))
        .nullish(),
    },
  ];
}
