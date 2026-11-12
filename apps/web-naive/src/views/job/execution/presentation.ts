import { $t } from '@vben/locales';
import { formatDateTime } from '@vben/utils';

type TagType = 'default' | 'error' | 'info' | 'success' | 'warning';

export function instanceStatusLabel(status: number) {
  const keys: Record<number, string> = {
    1: 'waiting',
    2: 'running',
    3: 'succeeded',
    4: 'failed',
    5: 'canceled',
    6: 'stopping',
  };
  return statusLabel(keys[status], status);
}

export function taskStatusLabel(status: number) {
  const keys: Record<number, string> = {
    1: 'waiting',
    2: 'running',
    3: 'retryWaiting',
    4: 'succeeded',
    5: 'failed',
    6: 'canceled',
  };
  return statusLabel(keys[status], status);
}

function statusLabel(key: string | undefined, status: number) {
  return key ? $t(`job-execution.status.${key}`) : String(status);
}

export function instanceStatusType(status: number): TagType {
  const types: Record<number, TagType> = {
    1: 'default',
    2: 'info',
    3: 'success',
    4: 'error',
    5: 'default',
    6: 'warning',
  };
  return types[status] ?? 'default';
}

export function taskStatusType(status: number): TagType {
  const types: Record<number, TagType> = {
    1: 'default',
    2: 'info',
    3: 'warning',
    4: 'success',
    5: 'error',
    6: 'default',
  };
  return types[status] ?? 'default';
}

export function instanceIsTerminal(status: number) {
  return status === 3 || status === 4 || status === 5;
}

export function taskIsTerminal(status: number) {
  return status === 4 || status === 5 || status === 6;
}

export function taskTypeLabel(type: number) {
  const keys: Record<number, string> = {
    1: 'ordinary',
    2: 'prepare',
    3: 'shard',
    4: 'post',
  };
  return keys[type] ? $t(`job-execution.taskType.${keys[type]}`) : String(type);
}

export function triggerLabel(type: number) {
  const keys: Record<number, string> = {
    1: 'scheduled',
    2: 'misfire',
    3: 'manual',
  };
  return keys[type] ? $t(`job-execution.trigger.${keys[type]}`) : String(type);
}

export function endReasonLabel(reason: null | string) {
  if (reason === null) return '—';
  const reasons = new Set([
    'dispatch_rejected',
    'execution_failed',
    'instance_timeout',
    'manual_stop',
    'result_unknown',
    'success',
  ]);
  return reasons.has(reason) ? $t(`job-execution.reason.${reason}`) : reason;
}

export function timeLabel(value: null | string) {
  return value === null ? '—' : formatDateTime(value);
}

export function positiveID(value: unknown) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '')
    return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
