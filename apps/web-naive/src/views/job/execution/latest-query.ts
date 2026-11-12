/** Prevents older VXE queries from publishing stale rows or stale errors. */
export function createLatestQuery<Result>() {
  let latest: Promise<Result>;
  return async (load: () => Promise<Result>) => {
    let current = load();
    latest = current;
    for (;;) {
      try {
        const result = await current;
        if (current === latest) return result;
      } catch (error) {
        if (current === latest) throw error;
      }
      current = latest;
    }
  };
}
