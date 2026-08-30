export interface DebouncedChangeRecorder<T> {
  push(before: T, after: T): void;
}

export function createDebouncedChangeRecorder<T>(
  delayMs: number,
  record: (before: T, after: T) => void | Promise<void>,
): DebouncedChangeRecorder<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let initialValue: T;
  let finalValue: T;
  let hasPendingChange = false;

  return {
    push(before, after) {
      if (!hasPendingChange) {
        initialValue = before;
        hasPendingChange = true;
      }
      finalValue = after;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const first = initialValue;
        const last = finalValue;
        timer = undefined;
        hasPendingChange = false;
        void record(first, last);
      }, delayMs);
    },
  };
}
