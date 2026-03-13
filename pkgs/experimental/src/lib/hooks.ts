import { proxy, useSnapshot } from 'valtio';

export function useNullishSnapshot<T extends object | null | undefined>(
  value: T,
): T {
  const hasValue = value != null;
  const snap = useSnapshot(value ?? proxy({}));
  return hasValue ? (snap as T) : (null as T);
}
