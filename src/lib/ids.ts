let counter = 0;

/** Session-unique id: readable prefix + monotonic counter + entropy. */
export function id(prefix = "z"): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
