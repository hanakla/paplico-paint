import { RedirectType, redirect } from 'next/navigation'

export default async function Page() {
  redirect('/docs/en/7e3b656f66c546f9a8f865062cc078e3', RedirectType.replace)
}
