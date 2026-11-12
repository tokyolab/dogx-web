import type { JobDefinitionApi } from '#/api/job/definition';

type Send = (
  request: JobDefinitionApi.Trigger,
) => Promise<{ instanceId: number }>;

function newRequestID() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Internal HTTP deployments may expose getRandomValues without randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte, index) => {
    if (index === 6) byte = (byte & 15) | 0x40;
    if (index === 8) byte = (byte & 63) | 0x80;
    return byte.toString(16).padStart(2, '0');
  }).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// An operation keeps one identity and immutable payload across uncertain request
// failures. The page owns its lifetime, including closing/reopening the dialog.
// Concurrent submits share one request; only a confirmed response ends it.
export function createTriggerOperation(
  id: number,
  send: Send,
  requestId: string = newRequestID(),
) {
  let request: Readonly<JobDefinitionApi.Trigger> | undefined;
  let pending: ReturnType<Send> | undefined;
  let confirmed: undefined | { instanceId: number };
  return {
    get request() {
      return request;
    },
    submit(values: { params: string; paramsOverridden: boolean }) {
      if (confirmed) return Promise.resolve(confirmed);
      if (pending) return pending;
      request ??= Object.freeze({
        id,
        requestId,
        paramsOverridden: values.paramsOverridden,
        ...(values.paramsOverridden ? { params: values.params } : {}),
      });
      pending = send({ ...request })
        .then((response) => {
          confirmed = response;
          return response;
        })
        .finally(() => {
          pending = undefined;
        });
      return pending;
    },
  };
}
export type TriggerOperation = ReturnType<typeof createTriggerOperation>;
