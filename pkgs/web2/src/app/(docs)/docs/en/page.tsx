import { RedirectType, redirect } from 'next/navigation'

export default async function Page() {
  redirect('/docs/en/00c7f0d6f5ae4e82b4d907f7b383bdfc', RedirectType.replace)
}
