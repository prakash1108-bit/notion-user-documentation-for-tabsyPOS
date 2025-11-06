import { Client } from '@notionhq/client'

async function fetchBlockChildren(notion, blockId) {
  let allBlocks = []
  let cursor = undefined
  let hasMore = true

  while (hasMore) {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    })
    allBlocks = allBlocks.concat(response.results)
    cursor = response.next_cursor
    hasMore = response.has_more
  }

  // Recursively fetch children for blocks that might contain nested content
  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i]
    if (block.has_children) {
      const children = await fetchBlockChildren(notion, block.id)
      block.children = children
    }
  }

  return allBlocks
}

function getPlainText(block) {
  let text = ''
  if (block[block.type]?.rich_text) {
    text = block[block.type].rich_text.map(rt => rt.plain_text).join('')
  }
  if (block.children) {
    for (const child of block.children) {
      text += ' ' + getPlainText(child)
    }
  }
  return text
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit')) || 5

  if (!query.trim()) {
    return Response.json([])
  }

  const notion = new Client({ auth: process.env.NOTION_TOKEN })
  const pageId = process.env.NOTION_PAGE_ID

  try {
    const blocks = await fetchBlockChildren(notion, pageId)

    let sections = []
    let currentSection = null
    let currentDoc = null

    for (const block of blocks) {
      if (block.type === 'heading_1') {
        if (currentSection) sections.push(currentSection)
        currentSection = {
          title: block.heading_1.rich_text.map(rt => rt.plain_text).join(''),
          docs: []
        }
        currentDoc = null
      } else if (block.type === 'heading_2' || block.type === 'heading_3') {
        if (currentSection) {
          if (currentDoc) currentSection.docs.push(currentDoc)
          const title = block[block.type].rich_text.map(rt => rt.plain_text).join('')
          const url = '/docs/' + encodeURIComponent(block.id)
          currentDoc = {
            title,
            pageTitle: title,
            url,
            content: '',
            sectionTitle: currentSection ? currentSection.title : ''
          }
        }
      } else if (currentDoc) {
        currentDoc.content += getPlainText(block) + ' '
      }
    }

    if (currentSection) {
      if (currentDoc) currentSection.docs.push(currentDoc)
      sections.push(currentSection)
    }

    let results = []
    const lowerQuery = query.toLowerCase()
    const words = lowerQuery.split(/\s+/).filter(w => w.length > 0)
    for (const section of sections) {
      for (const doc of section.docs) {
        const titleLower = doc.title.toLowerCase()
        const contentLower = doc.content.toLowerCase()
        if (words.every(word => titleLower.includes(word) || contentLower.includes(word))) {
          let score = 0
          if (words.every(word => titleLower.includes(word))) score = 10
          else if (words.every(word => contentLower.includes(word))) score = 1
          results.push({
            title: doc.title,
            pageTitle: doc.pageTitle,
            url: doc.url,
            sectionTitle: doc.sectionTitle,
            score
          })
        }
      }
    }

    // Sort by score descending, then by title ascending
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.title.localeCompare(b.title)
    })

    results = results.slice(0, limit)

    return Response.json(results)
  } catch (error) {
    console.error('Error searching:', error)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}