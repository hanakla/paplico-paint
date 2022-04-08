import { ComponentType } from 'react'

export type PropsOf<T extends ComponentType<any>> = T extends ComponentType<
  infer R
>
  ? R
  : never
