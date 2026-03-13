import { nanoid } from 'nanoid';

export function generateUid() {
  return nanoid(30);
}

export function generateRandomNumber(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0];
}
