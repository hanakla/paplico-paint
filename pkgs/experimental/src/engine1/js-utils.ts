export function exactNonNull<T>(v: T | null | undefined): asserts v is T {
  if (v == null) {
    throw new Error('Value cannot be null or undefined');
  }
}
