import { DetailedHTMLProps, InputHTMLAttributes } from 'react'

type Props = DetailedHTMLProps<
  InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

export const Checkbox = ({ type, ...props }: Props) => {
  return <input type="checkbox" {...props} />
}
