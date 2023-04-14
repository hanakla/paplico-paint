import { GetServerSideProps } from 'next'
import Link from 'next/link'

export default function Index() {
  return (
    <>
      <Link href="/app">アプリへ</Link>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    redirect: {
      permanent: false,
      destination: '/v2',
    },
  }
}
