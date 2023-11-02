import { Fragment, ReactNode } from 'react'
import Link from 'next/link'
import styles from './NotionBlocks.module.css'
import {
  BlockObjectResponse,
  RichTextItemResponse,
  TextRichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { getDatabase, getToCByBlocks } from '@/infra/notion'
import { Highlight } from './Highlight'

export async function NotionPage({
  blocks,
  disablePageLink = false,
}: {
  blocks: BlockObjectResponse[]
  disablePageLink?: boolean
}) {
  console.log({ disablePageLink })
  return (
    <>
      {await Promise.all(
        blocks.map(async (block, idx) => (
          <Fragment key={idx}>
            {await renderBlock(block, blocks, disablePageLink)}
          </Fragment>
        )),
      )}
    </>
  )
}

async function renderBlock(
  block: BlockObjectResponse,
  blocks: BlockObjectResponse[],
  disablePageLink: boolean = false,
) {
  const { type, id } = block
  const value = block[type]

  switch (type) {
    case 'paragraph':
      return (
        <p className="my-4 tracking-wide leading-8">
          <Text
            className="text-4 my-4 font-sans mb-8 tracking-wider"
            items={value.rich_text}
          />
        </p>
      )
    case 'heading_1':
      return (
        <h1 className="text-4xl font-sans font-light md:mt-16 sm:mt-12 mb-4">
          <a id={block.id} />
          <Text items={value.rich_text} />
        </h1>
      )
    case 'heading_2':
      return (
        <h2 className="text-3xl font-sans font-light my-4 mt-7">
          <a id={block.id} />
          <Text items={value.rich_text} />
        </h2>
      )
    case 'heading_3':
      return (
        <h3>
          <a id={block.id} />
          <Text items={value.rich_text} />
        </h3>
      )
    case 'bulleted_list': {
      console.log(value.children)
      return (
        <ul className="list-disc ml-6 my-3 space-y-1 ">
          {value.children.map((child) =>
            renderBlock(child, blocks, disablePageLink),
          )}
        </ul>
      )
    }
    case 'numbered_list': {
      return (
        <ol>
          {value.children.map((child) =>
            renderBlock(child, blocks, disablePageLink),
          )}
        </ol>
      )
    }
    case 'bulleted_list_item':
    case 'numbered_list_item':
      return (
        <li key={block.id}>
          <Text items={value.rich_text} />
          {/* eslint-disable-next-line no-use-before-define */}
          {!!value.children && renderNestedList(block)}
        </li>
      )
    case 'to_do':
      return (
        <div>
          <label htmlFor={id}>
            <input type="checkbox" id={id} defaultChecked={value.checked} />{' '}
            <Text items={value.rich_text} />
          </label>
        </div>
      )
    case 'toggle':
      return (
        <details>
          <summary>
            <Text items={value.rich_text} />
          </summary>
          {block.children?.map((child) => (
            <Fragment key={child.id}>
              {renderBlock(child, blocks, disablePageLink)}
            </Fragment>
          ))}
        </details>
      )
    case 'child_page':
      if (disablePageLink) return null
      return (
        <Link href={`/docs/en/${block.id}`}>
          <strong>{value.title}</strong>
        </Link>
        // <div className={styles.childPage}>
        //   <strong>{value?.title}</strong>
        //   {block.children.map((child) => renderBlock(child))}
        // </div>
      )
    case 'image': {
      const src =
        value.type === 'external' ? value.external.url : value.file.url
      const caption = value.caption ? value.caption[0]?.plain_text : ''
      return (
        <figure>
          <img src={src} alt={caption} />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )
    }
    case 'divider':
      return <hr key={id} />
    case 'quote':
      return <blockquote key={id}>{value.rich_text[0].plain_text}</blockquote>
    case 'code':
      return (
        <Highlight
          code={value.rich_text[0].plain_text}
          language={value.language}
        >
          a
        </Highlight>
        // <pre className="relative bg-lime-100 my-4 p-6 pt-8 rounded-lg ">
        //   <span className="absolute top-0 px-2 bg-teal-500 text-white ">
        //     {value.language}
        //   </span>

        //   <code className="text-black" key={id}>
        //     {value.rich_text[0].plain_text}
        //   </code>
        // </pre>
      )
    case 'file': {
      const srcFile =
        value.type === 'external' ? value.external.url : value.file.url
      const splitSourceArray = srcFile.split('/')
      const lastElementInArray = splitSourceArray[splitSourceArray.length - 1]
      const captionFile = value.caption ? value.caption[0]?.plain_text : ''
      return (
        <figure>
          <div className={styles.file}>
            📎{' '}
            <Link href={srcFile} passHref>
              {lastElementInArray.split('?')[0]}
            </Link>
          </div>
          {captionFile && <figcaption>{captionFile}</figcaption>}
        </figure>
      )
    }
    case 'bookmark': {
      const href = value.url
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className={styles.bookmark}
        >
          {href}
        </a>
      )
    }
    case 'table': {
      return (
        <table className={styles.table}>
          <tbody>
            {block.children?.map((child, index) => {
              const RowElement =
                value.has_column_header && index === 0 ? 'th' : 'td'
              return (
                <tr key={child.id}>
                  {child.table_row?.cells?.map((cell, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <RowElement key={`${cell.plain_text}-${i}`}>
                      <Text items={cell} />
                    </RowElement>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      )
    }
    case 'column_list': {
      return (
        <div className={styles.row}>
          {block.children.map((childBlock) => renderBlock(childBlock))}
        </div>
      )
    }
    case 'column': {
      return <div>{block.children.map((child) => renderBlock(child))}</div>
    }
    case 'child_database':
      const db = await getDatabase(block.id)

      return (
        <div className="grid grid-cols-2 my-12">
          {db.map((row) => (
            <div>
              <Link href={`/docs/en/${row.id.replaceAll('-', '')}`}>
                <div className="aspect-[16/12] w-full mb-2">
                  {row.cover && (
                    <img
                      className="rounded-lg aspect-[16/12]"
                      src={
                        row.cover?.type === 'external'
                          ? row.cover.external.url
                          : row.cover?.type === 'file'
                          ? row.cover.file.url
                          : undefined
                      }
                      alt={row.properties.title?.title?.[0]?.text?.content}
                    />
                  )}
                </div>
                <div className="font-light">
                  {row.properties.title?.title?.[0]?.text?.content}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )

    case 'table_of_contents': {
      let toc = getToCByBlocks(blocks)

      return (
        <div
          className="my-7 bg-white p-4 rounded-md"
          role="navigation"
          aria-label="Table of contents"
        >
          <h4 className="mb-2 text-base font-light">Table of Contents</h4>

          {toc.map((item) => (
            <a
              href={`#${item.id}`}
              className={`block py-1 text-base hover:bg-lime-200 rounded-md`}
              style={{
                paddingLeft: item.depth * 1 + 'rem',
              }}
            >
              <span className="border-b-1 border-b-lime-300">{item.title}</span>
            </a>
          ))}
        </div>
      )
    }
    default:
      return (
        <>
          ❌ Unsupported block (
          {type === 'unsupported' ? 'unsupported by Notion API' : type})
          <div className="max-h-28 overflow-scroll text-sm">
            <pre>{JSON.stringify(block, null, 2)}</pre>
          </div>
        </>
      )
  }
}

export function renderNestedList(blocks) {
  const { type } = blocks
  const value = blocks[type]
  if (!value) return null

  const isNumberedList = value.children[0].type === 'numbered_list_item'

  if (isNumberedList) {
    return <ol>{value.children.map((block) => renderBlock(block))}</ol>
  }
  return <ul>{value.children.map((block) => renderBlock(block))}</ul>
}

function Text({
  items,
  className,
}: {
  items: RichTextItemResponse[]
  className?: string
}) {
  if (!items) {
    return null
  }

  console.log(items)
  return items.map((value, idx) => {
    const {
      annotations: { bold, code, color, italic, strikethrough, underline },
    } = value

    let textContent = ''
    let link: string | undefined = undefined

    if (value.type === 'text') {
      textContent = value.text.content
      link = value.text.link?.url
    } else if (value.type === 'mention') {
      textContent = value.plain_text
      link =
        value.mention.type === 'page' ? `/docs/en/${value.mention.page.id}` : ''
    }

    const displayElement = textContent.split('\n').reduce((acc, cur, i) => {
      return [...acc, i > 0 ? <br key={idx} /> : '', cur]
    }, [] as ReactNode[])

    return (
      <span
        className={[
          bold ? styles.bold : '',
          code ? 'bg-lime-200 font-light px-1 py-1 rounded-lg' : '',
          italic ? styles.italic : '',
          strikethrough ? styles.strikethrough : '',
          underline ? styles.underline : '',
          className,
        ].join(' ')}
        style={color !== 'default' ? { color } : {}}
        key={idx}
      >
        {link ? <a href={link}>{displayElement}</a> : displayElement}
      </span>
    )
  })
}
