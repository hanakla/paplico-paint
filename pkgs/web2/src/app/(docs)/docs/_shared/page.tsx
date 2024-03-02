import { NotionPage } from '@/app/(docs)/docs/NotionPage'
import { getBlocks, getPage, getToCByBlocks } from '@/infra/notion'

export async function DocsPage({ params: { id } }: { params: { id: string } }) {
  const page = await getPage(id)
  const blocks = await getBlocks(id)
  return (
    <section>
      <h1 className="md:text-5xl mb-12">
        {page.properties.title.title[0].plain_text}
      </h1>

      <NotionPage blocks={blocks} disablePageLink />
    </section>
  )
}
