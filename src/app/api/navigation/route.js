import { Client } from '@notionhq/client'

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  const notion = new Client({ auth: process.env.NOTION_TOKEN })
  const pageId = process.env.NOTION_PAGE_ID

  try {
    let allBlocks = []
    let cursor = undefined
    let hasMore = true

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      })
      allBlocks = allBlocks.concat(response.results)
      cursor = response.next_cursor
      hasMore = response.has_more
    }

    const blocks = allBlocks

    let navigation = []
    let currentSection = null

    for (const block of blocks) {
      if (block.type === 'heading_1') {
        if (currentSection) navigation.push(currentSection)
        currentSection = {
          title: block.heading_1.rich_text.map(rt => rt.plain_text).join('') || '',
          links: []
        }
      } else if (block.type === 'heading_2' || block.type === 'heading_3') {
        if (currentSection) {
          const title = block[block.type].rich_text.map(rt => rt.plain_text).join('') || ''
          const href = '/docs/' + encodeURIComponent(block.id)
          currentSection.links.push({ title, href })
        }
      }
    }

    if (currentSection) navigation.push(currentSection)

    return Response.json(navigation)
  } catch (error) {
    console.error('Error fetching navigation from Notion:', error)
    return Response.json({ error: 'Failed to fetch navigation' }, { status: 500 })
  }
}