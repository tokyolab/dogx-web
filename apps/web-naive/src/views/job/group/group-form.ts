import type { VbenFormSchema } from '#/adapter/form';

import { $t } from '@vben/locales';

import { z } from '#/adapter/form';

export function groupFormSchema(): VbenFormSchema[] {
  const t = (key: string) => $t(`job-group.${key}`);
  const identity = (
    fieldName: 'discoveryKey' | 'name',
    max: number,
    help: string,
  ): VbenFormSchema => ({
    component: 'Input',
    componentProps: {
      maxlength: max,
      placeholder: t(`${fieldName}Placeholder`),
    },
    fieldName,
    help: t(help),
    label: t(fieldName),
    // Validate immutable identities without normalizing the submitted value.
    rules: z
      .string({
        required_error: t(`${fieldName}Required`),
        invalid_type_error: t(`${fieldName}Required`),
      })
      .min(1, t(`${fieldName}Required`))
      .max(max, t(`${fieldName}TooLong`))
      .refine((value) => value === value.trim(), t(`${fieldName}Whitespace`))
      .refine((value) => !value.includes('\0'), t(`${fieldName}Invalid`)),
  });
  return [
    identity('name', 128, 'identityHelp'),
    identity('discoveryKey', 255, 'keyHelp'),
  ];
}
