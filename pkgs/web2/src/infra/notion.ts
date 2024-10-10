// FROM: https://github.com/samuelkraft/notion-blog-nextjs
// Copyright (c) 2023 Travis Fischer LICENSED under MIT
import { Client } from '@notionhq/client'
import {
  BlockObjectResponse,
  DatabaseObjectResponse,
  PartialBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { cache } from 'react'

export const revalidate = 3600 // revalidate the data at most every hour

const databaseId = process.env.NOTION_DATABASE_ID!

/**
 * Returns a random integer between the specified values, inclusive.
 * The value is no lower than `min`, and is less than or equal to `max`.
 *
 * @param {number} minimum - The smallest integer value that can be returned, inclusive.
 * @param {number} maximum - The largest integer value that can be returned, inclusive.
 * @returns {number} - A random integer between `min` and `max`, inclusive.
 */
function getRandomInt(minimum, maximum) {
  const min = Math.ceil(minimum)
  const max = Math.floor(maximum)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

export const getDatabase = cache(async (databaseId: string) => {
  const response = await notion.databases.query({
    database_id: databaseId,
  })
  return response.results as DatabaseObjectResponse[]
})

export const getPage = cache(async (pageId: string) => {
  console.log(pageId)
  const response = await notion.pages.retrieve({ page_id: pageId })
  return response
})

export const getBlocks = cache(async (blockId: string): Promise<any[]> => {
  const { results } = await notion.blocks.children.list({
    block_id: blockId,
    page_size: 100,
  })

  // Fetches all child blocks recursively
  // be mindful of rate limits if you have large amounts of nested blocks
  // See https://developers.notion.com/docs/working-with-page-content#reading-nested-blocks
  const childBlocks: BlockObjectResponse &
    { children?: BlockObjectResponse }[] = await Promise.all(
    results.map(async (block) => {
      if ((block as BlockObjectResponse).has_children) {
        const children = await getBlocks(block.id)
        return { ...block, children }
      }

      return block as BlockObjectResponse
    }),
  )

  return childBlocks.reduce((acc, curr) => {
    const prev = acc[acc.length - 1]

    if (!('type' in curr)) {
      console.log('what is this', curr)
    }

    if (curr.type === 'bulleted_list_item') {
      if (prev?.type === 'bulleted_list') {
        prev[prev.type].children?.push(curr)
      } else {
        acc.push({
          id: getRandomInt(10 ** 99, 10 ** 100).toString(),
          type: 'bulleted_list',
          bulleted_list: { children: [curr] },
        })
      }
    } else if (curr.type === 'numbered_list_item') {
      if (prev?.type === 'numbered_list') {
        prev[prev.type].children?.push(curr)
      } else {
        acc.push({
          id: getRandomInt(10 ** 99, 10 ** 100).toString(),
          type: 'numbered_list',
          numbered_list: { children: [curr] },
        })
      }
    } else {
      acc.push(curr)
    }
    return acc
  }, [] as any)
})

export function getToCByBlocks(blocks: BlockObjectResponse[]) {
  let toc: { id: string; title: string; depth: number }[] = []

  // console.log(block)
  // console.log(block[block.type]!)
  blocks.forEach((block) => {
    const { type } = block

    if (
      type in block &&
      (type === 'heading_1' || type === 'heading_2' || type === 'heading_3')
    ) {
      toc.push({
        id: block.id,
        title: block[type].rich_text[0]?.plain_text,
        depth:
          block.type === 'heading_1' ? 1 : block.type === 'heading_2' ? 2 : 3,
      })
    }
  })
  return toc
}
