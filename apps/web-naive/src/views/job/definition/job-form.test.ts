import { describe, expect, it, vi } from 'vitest';

import enUI from '../../../../../../packages/locales/src/langs/en-US/ui.json';
import zhUI from '../../../../../../packages/locales/src/langs/zh-CN/ui.json';
import enJob from '../../../locales/langs/en-US/job-management.json';
import zhJob from '../../../locales/langs/zh-CN/job-management.json';
import { defaultJobInput, jobFormSchema } from './job-form';

const language = vi.hoisted(() => ({ value: 'zh-CN' }));
vi.mock('@vben/locales', () => ({
  $t: (key: string, values: Record<string, unknown> | unknown[] = {}) => {
    const resources =
      language.value === 'zh-CN'
        ? { 'job-management': zhJob, ui: zhUI }
        : { 'job-management': enJob, ui: enUI };
    let message: unknown = resources;
    for (const segment of key.split('.')) {
      message = (message as Record<string, unknown>)[segment];
    }
    if (typeof message !== 'string')
      throw new Error(`Missing translation: ${key}`);
    return message.replaceAll(/\{(\w+)\}/g, (_, parameter: string) =>
      String((values as Record<string, unknown>)[parameter]),
    );
  },
}));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { z };
});
vi.mock('../group/group-select.vue', () => ({ default: {} }));
vi.mock('./cron-input.vue', () => ({ default: {} }));

function parse(field: string, value: unknown) {
  const rule = jobFormSchema().find((entry) => entry.fieldName === field)
    ?.rules as {
    safeParse: (value: unknown) => {
      error?: { issues: { message: string }[] };
      success: boolean;
    };
  };
  return rule.safeParse(value);
}

describe.each(['zh-CN', 'en-US'])('job form validation (%s)', (locale) => {
  it.each([
    ['name', '', '请输入任务名称', 'Please enter Job name'],
    ['name', '   ', '请输入任务名称', 'Please enter Job name'],
    ['name', null, '请输入任务名称', 'Please enter Job name'],
    ['name', undefined, '请输入任务名称', 'Please enter Job name'],
    ['processorName', '', '请输入处理器名称', 'Please enter Processor name'],
    ['cronExpr', '', '请输入Cron 表达式', 'Please enter Cron expression'],
    ['executorGroupId', 0, '请选择执行器组', 'Please select Executor group'],
    ['executorGroupId', null, '请选择执行器组', 'Please select Executor group'],
    ['executionMode', null, '请选择执行模式', 'Please select Execution mode'],
    [
      'misfirePolicy',
      null,
      '请选择错过调度策略',
      'Please select Missed schedule policy',
    ],
    ['blockPolicy', null, '请选择阻塞策略', 'Please select Overlap policy'],
    ['maxRetries', null, '请输入最大重试次数', 'Please enter Maximum retries'],
    [
      'timeoutSeconds',
      null,
      '请输入实例超时（秒）',
      'Please enter Instance timeout (seconds)',
    ],
    [
      'retryIntervalSeconds',
      undefined,
      '请输入重试间隔（秒）',
      'Please enter Retry interval (seconds)',
    ],
    [
      'name',
      'a'.repeat(129),
      '任务名称最多128个字符',
      'Job name can be at most 128 characters',
    ],
    [
      'processorName',
      'a'.repeat(129),
      '处理器名称最多128个字符',
      'Processor name can be at most 128 characters',
    ],
    [
      'cronExpr',
      'a'.repeat(129),
      'Cron 表达式最多128个字符',
      'Cron expression can be at most 128 characters',
    ],
    [
      'remark',
      'a'.repeat(501),
      '备注最多500个字符',
      'Remark can be at most 500 characters',
    ],
  ])('localizes %s errors for %s', (field, value, chinese, english) => {
    language.value = locale;
    const result = parse(field as string, value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      locale === 'zh-CN' ? chinese : english,
    );
  });

  it.each([
    ['maxRetries', -1, 0],
    ['maxRetries', 1.5, 0],
    ['maxRetries', 2_147_483_648, 0],
    ['retryIntervalSeconds', 0, 1],
    ['retryIntervalSeconds', 1.5, 1],
    ['timeoutSeconds', 0, 1],
    ['timeoutSeconds', 2_147_483_648, 1],
  ])('localizes numeric bounds for %s = %s', (field, value, min) => {
    language.value = locale;
    const result = parse(field as string, value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      locale === 'zh-CN'
        ? `请输入 ${min} 至 2147483647 之间的整数`
        : `Enter an integer between ${min} and 2147483647`,
    );
  });

  it('accepts configured defaults and a cleared optional remark', () => {
    language.value = locale;
    const values = {
      ...defaultJobInput(),
      name: 'Local form check',
      executorGroupId: 1,
      processorName: 'registered.processor',
      cronExpr: '0 * * * * *',
    };
    for (const schema of jobFormSchema().filter((field) => field.rules)) {
      expect(
        parse(schema.fieldName, values[schema.fieldName as keyof typeof values])
          .success,
      ).toBe(true);
    }
    expect(parse('remark', null).success).toBe(true);
    expect(parse('remark', undefined).success).toBe(true);
  });
});
