import { Client } from '@notionhq/client'

export async function GET(request, { params }) {
  const { slug } = params
  const decodedSlug = decodeURIComponent(slug)
  const notion = new Client({ auth: process.env.NOTION_TOKEN })
  const pageId = process.env.NOTION_PAGE_ID

  try {
    // Fetch all blocks from the page
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

    // Find the index of the heading_2 with the matching id
    const targetIndex = blocks.findIndex(block => block.id === decodedSlug)
    if (targetIndex === -1 || blocks[targetIndex].type !== 'heading_2') {
      return Response.json({ error: 'Block not found' }, { status: 404 })
    }

    const title = blocks[targetIndex].heading_2.rich_text.map(rt => rt.plain_text).join('')

    // Collect blocks from the next one until the next heading_1 or heading_2
    let contentBlocks = []
    for (let i = targetIndex + 1; i < blocks.length; i++) {
      const block = blocks[i]
      if (block.type === 'heading_1' || block.type === 'heading_2') {
        break
      }
      contentBlocks.push(block)
    }

    let content = ''
    for (const block of contentBlocks) {
      content += blockToMarkdown(block) + '\n'
    }

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
    case 'toggle':
      return `<details>\n<summary>${formatRichText(block.toggle.rich_text)}</summary>\n\n</details>\n\n`;
    default:
      const richText = block[block.type]?.rich_text;
      return richText ? formatRichText(richText) + '\n\n' : '';
  }
}