/**
 * A push queue exposed as an AsyncIterable.
 *
 * The socket pushes frames in; a `for await` loop pulls them out. Values that
 * arrive before anyone is waiting are buffered, `end()` finishes the iteration
 * after the buffer drains, and `fail()` rejects the next pull so the consumer
 * sees a real error instead of hanging forever.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private buffer: T[] = [];
  private waiters: Array<{ resolve: (r: IteratorResult<T>) => void; reject: (e: unknown) => void }> = [];
  private closed = false;
  private failure: unknown = undefined;
  private failed = false;

  /** Called once when the consumer stops early (`break`, `return`) or the queue closes. */
  onClose: (() => void) | null = null;

  get isClosed(): boolean {
    return this.closed;
  }

  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve({ value, done: false });
    else this.buffer.push(value);
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    for (const w of this.waiters.splice(0)) w.resolve({ value: undefined, done: true });
    this.onClose?.();
    this.onClose = null;
  }

  fail(error: unknown): void {
    if (this.closed) return;
    this.closed = true;
    this.failed = true;
    this.failure = error;
    for (const w of this.waiters.splice(0)) w.reject(error);
    this.onClose?.();
    this.onClose = null;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const buffered = this.buffer.shift();
        if (buffered !== undefined) return Promise.resolve({ value: buffered, done: false });
        if (this.failed) {
          // Deliver the failure once; later pulls see a clean end.
          this.failed = false;
          return Promise.reject(this.failure);
        }
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<T>>((resolve, reject) => {
          this.waiters.push({ resolve, reject });
        });
      },
      return: () => {
        this.end();
        this.buffer = [];
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
