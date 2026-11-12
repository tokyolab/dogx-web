import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createDetailRefresh } from './detail-refresh';

interface Result {
  id: number;
  terminal: boolean;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function fixture() {
  const reads: ReturnType<typeof deferred<Result>>[] = [];
  const load = vi.fn(() => {
    const request = deferred<Result>();
    reads.push(request);
    return request.promise;
  });
  const read = (index: number) => {
    const request = reads[index];
    assert(request, `Expected pending read at index ${index}`);
    return request;
  };
  const apply = vi.fn();
  const onError = vi.fn();
  const refresh = createDetailRefresh<number, Result>({
    apply,
    load,
    onError,
    onLoading: vi.fn(),
    shouldRefresh: (result) => !result.terminal,
  });
  return { apply, load, onError, read, refresh };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('execution detail refresh', () => {
  it('keeps one read in flight and waits five seconds after completion', async () => {
    const { load, read, refresh } = fixture();
    refresh.select(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(1);
    read(0).resolve({ id: 1, terminal: false });
    await vi.advanceTimersByTimeAsync(4999);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);
    refresh.dispose();
  });

  it('discards an old target and coalesces intervening target changes', async () => {
    const { apply, load, read, refresh } = fixture();
    refresh.select(1);
    refresh.select(2);
    refresh.select(3);
    expect(load).toHaveBeenCalledTimes(1);
    read(0).resolve({ id: 1, terminal: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(apply).not.toHaveBeenCalled();
    expect(load).toHaveBeenLastCalledWith(3);
    read(1).resolve({ id: 3, terminal: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(apply).toHaveBeenCalledExactlyOnceWith(
      { id: 3, terminal: false },
      3,
    );
    refresh.dispose();
  });

  it('drops a response after close and does not restart polling', async () => {
    const { apply, load, read, refresh } = fixture();
    refresh.select(1);
    refresh.select(undefined);
    read(0).resolve({ id: 1, terminal: false });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(apply).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    refresh.dispose();
  });

  it('stops hidden work, discards its response, and resumes with a fresh read', async () => {
    const { apply, load, read, refresh } = fixture();
    refresh.select(1);
    refresh.setEnabled(false);
    read(0).resolve({ id: 1, terminal: false });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    refresh.setEnabled(true);
    expect(load).toHaveBeenCalledTimes(2);
    refresh.dispose();
  });

  it('honors pause and terminal states while allowing an explicit refresh', async () => {
    const { load, read, refresh } = fixture();
    refresh.select(1);
    read(0).resolve({ id: 1, terminal: false });
    await vi.advanceTimersByTimeAsync(0);
    refresh.setPaused(true);
    refresh.setEnabled(false);
    refresh.setEnabled(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(1);
    refresh.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    read(1).resolve({ id: 1, terminal: true });
    await vi.advanceTimersByTimeAsync(0);
    refresh.setPaused(false);
    refresh.setEnabled(false);
    refresh.setEnabled(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(2);
    refresh.dispose();
  });

  it('retries failed reads without overlapping or surfacing obsolete errors', async () => {
    const { load, onError, read, refresh } = fixture();
    refresh.select(1);
    refresh.select(2);
    read(0).reject(new Error('old request failed'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).not.toHaveBeenCalled();
    read(1).reject(new Error('current request failed'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(load).toHaveBeenCalledTimes(3);
    refresh.dispose();
  });
});
