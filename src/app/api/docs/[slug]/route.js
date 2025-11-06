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

export async function GET(request, { params }) {
  const { slug } = params
  const decodedSlug = decodeURIComponent(slug)
  const notion = new Client({ auth: process.env.NOTION_TOKEN })
  const pageId = process.env.NOTION_PAGE_ID

  try {
    // Fetch all blocks recursively
    const blocks = await fetchBlockChildren(notion, pageId)

    // Find the index of the heading_2 or heading_3 with the matching id
    const targetIndex = blocks.findIndex(block => (block.type === 'heading_2' || block.type === 'heading_3') && block.id === decodedSlug)
    if (targetIndex === -1 || !(blocks[targetIndex].type === 'heading_2' || blocks[targetIndex].type === 'heading_3')) {
      return Response.json({ error: 'Block not found' }, { status: 404 })
    }

    const title = blocks[targetIndex][blocks[targetIndex].type].rich_text.map(rt => rt.plain_text).join('')

    // Collect blocks from the next one until the next heading_1, heading_2, or heading_3
    let contentBlocks = []
    for (let i = targetIndex + 1; i < blocks.length; i++) {
      const block = blocks[i]
      if (block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3') {
        break
      }
      contentBlocks.push(block)
    }

    // For image blocks with Notion-hosted files, refresh the URLs
    async function refreshImageUrls(blocks) {
      for (const block of blocks) {
        if (block.type === 'image' && block.image.type === 'file') {
          try {
            const response = await notion.blocks.retrieve({ block_id: block.id })
            block.image.file.url = response.image.file.url
          } catch (error) {
            console.error('Error refreshing image URL:', error)
          }
        }
        if (block.children) {
          await refreshImageUrls(block.children)
        }
      }
    }

    await refreshImageUrls(contentBlocks)

    let content = ''
    function processBlocks(blocks) {
      for (const block of blocks) {
        content += blockToMarkdown(block)
        if (block.children) {
          processBlocks(block.children)
        }
      }
    }
    processBlocks(contentBlocks)

    return Response.json({ 
      title, 
      content: content.trim() 
    })
  } catch (error) {
    console.error('Error fetching doc content:', error)
    return Response.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}

function formatRichText(richTextArray) {
  return richTextArray.map(rt => {
    let text = rt.plain_text;
    if (rt.annotations.bold) text = `**${text}**`;
    if (rt.annotations.italic) text = `*${text}*`;
    if (rt.annotations.strikethrough) text = `~~${text}~~`;
    if (rt.annotations.code) text = `\`${text}\``;
    if (rt.href) text = `[${text}](${rt.href})`;
    return text;
  }).join('');
}

function blockToMarkdown(block) {
  switch (block.type) {
    case 'paragraph':
      const text = formatRichText(block.paragraph.rich_text);
      return text ? text + '\n\n' : '\n';
    case 'heading_3':
      return '### ' + formatRichText(block.heading_3.rich_text) + '\n\n';
    case 'heading_4':
      return '#### ' + formatRichText(block.heading_4.rich_text) + '\n\n';
    case 'bulleted_list_item':
      return '* ' + formatRichText(block.bulleted_list_item.rich_text) + '\n';
    case 'numbered_list_item':
      return '1. ' + formatRichText(block.numbered_list_item.rich_text) + '\n';
    case 'code':
      const language = block.code.language || '';
      return '```' + language + '\n' + 
             formatRichText(block.code.rich_text) + 
             '\n```\n\n';
    case 'quote':
      return '> ' + formatRichText(block.quote.rich_text) + '\n\n';
    case 'divider':
      return '---\n\n';
    case 'callout':
      const emoji = block.callout.icon?.emoji || '';
      return `{% callout type="note" %}\n${emoji} ${formatRichText(block.callout.rich_text)}\n{% /callout %}\n\n`;
    case 'image':
      const imageUrl = block.image.type === 'external' 
        ? block.image.external.url 
        : block.image.file.url;
      const caption = block.image.caption 
        ? formatRichText(block.image.caption) 
        : 'Image';
      return `![${caption}](${imageUrl})\n\n`;
    case 'toggle':
      return `<details>\n<summary>${formatRichText(block.toggle.rich_text)}</summary>\n\n</details>\n\n`;
    default:
      const richText = block[block.type]?.rich_text;
      return richText ? formatRichText(richText) + '\n\n' : '';
  }
}