interface DetailRefreshOptions<Query, Result> {
  apply: (result: Result, query: Query) => void;
  load: (query: Query) => Promise<Result>;
  onError: () => void;
  onLoading: (loading: boolean) => void;
  shouldRefresh: (result: Result) => boolean;
}

/**
 * Serializes detail reads, including target changes during an in-flight read.
 * Hidden or closed views discard old responses. Polling waits five seconds
 * after completion; a manual refresh also works when paused or terminal.
 */
export function createDetailRefresh<Query, Result>(
  options: DetailRefreshOptions<Query, Result>,
) {
  let query: Query | undefined;
  let generation = 0;
  let running = false;
  let pending = false;
  let enabled = true;
  let paused = false;
  let refreshable = true;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    clearTimer();
    if (disposed || !enabled || paused || !refreshable || query === undefined)
      return;
    timer = setTimeout(refresh, 5000);
  }

  async function run() {
    if (disposed || running || !enabled || query === undefined) return;
    const current = query;
    const token = generation;
    running = true;
    pending = false;
    clearTimer();
    options.onLoading(true);
    try {
      const result = await options.load(current);
      if (disposed || token !== generation || !enabled) return;
      refreshable = options.shouldRefresh(result);
      options.apply(result, current);
    } catch {
      if (!disposed && token === generation && enabled) options.onError();
    } finally {
      running = false;
      if (!disposed) options.onLoading(false);
      if (pending && enabled && query !== undefined) void run();
      else schedule();
    }
  }

  function refresh() {
    if (disposed || query === undefined || !enabled) return;
    pending = true;
    void run();
  }

  return {
    dispose() {
      disposed = true;
      generation++;
      query = undefined;
      pending = false;
      clearTimer();
    },
    refresh,
    select(next: Query | undefined) {
      generation++;
      query = next;
      pending = next !== undefined;
      refreshable = true;
      clearTimer();
      if (pending) void run();
    },
    setEnabled(value: boolean) {
      if (enabled === value || disposed) return;
      enabled = value;
      generation++;
      pending = false;
      clearTimer();
      if (enabled && refreshable && !paused) refresh();
    },
    setPaused(value: boolean) {
      paused = value;
      if (paused) clearTimer();
      else if (!running) schedule();
    },
  };
}
