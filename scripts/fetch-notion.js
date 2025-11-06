import { Client } from '@notionhq/client';
import fs from 'fs/promises';
import path from 'path';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function fetchBlockChildren(blockId) {
  let allBlocks = [];
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    });
    allBlocks = allBlocks.concat(response.results);
    cursor = response.next_cursor;
    hasMore = response.has_more;
  }

  // Recursively fetch children for blocks that might contain nested content
  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i];
    if (block.has_children) {
      const children = await fetchBlockChildren(block.id);
      block.children = children;
    }
  }

  return allBlocks;
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
    case 'heading_1':
      return '# ' + formatRichText(block.heading_1.rich_text) + '\n\n';
    case 'heading_2':
      return '## ' + formatRichText(block.heading_2.rich_text) + '\n\n';
    case 'paragraph':
      const text = formatRichText(block.paragraph.rich_text);
      return text ? text + '\n\n' : '\n';
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
    case 'image':
      const imageUrl = block.image.type === 'external' 
        ? block.image.external.url 
        : block.image.file.url;
      const caption = block.image.caption 
        ? formatRichText(block.image.caption) 
        : 'Image';
      return `![${caption}](${imageUrl})\n\n`;
    default:
      const richText = block[block.type]?.rich_text;
      return richText ? formatRichText(richText) + '\n\n' : '';
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function processBlocks(blocks) {
  const headings = [];
  let currentH1 = null;
  let currentH2 = null;
  let currentContent = '';
  
  for (const block of blocks) {
    if (block.type === 'heading_1') {
      // Save previous content if exists
      if (currentH2) {
        await saveContent(currentH2.title, currentH2.content);
      } else if (currentH1) {
        await saveContent(currentH1.title, currentContent);
      }
      
      currentH1 = {
        title: formatRichText(block.heading_1.rich_text),
        content: blockToMarkdown(block)
      };
      currentH2 = null;
      currentContent = '';
      headings.push({ level: 1, title: currentH1.title });
    } else if (block.type === 'heading_2') {
      // Save previous content if exists
      if (currentH2) {
        await saveContent(currentH2.title, currentH2.content);
      }
      
      currentH2 = {
        title: formatRichText(block.heading_2.rich_text),
        content: (currentH1 ? currentH1.content : '') + blockToMarkdown(block)
      };
      currentContent = '';
      headings.push({ level: 2, title: currentH2.title });
    } else {
      const markdown = blockToMarkdown(block);
      if (currentH2) {
        currentH2.content += markdown;
      } else if (currentH1) {
        currentContent += markdown;
      }
    }
  }
  
  // Save the last section
  if (currentH2) {
    await saveContent(currentH2.title, currentH2.content);
  } else if (currentH1) {
    await saveContent(currentH1.title, currentContent);
  }
  
  // Save headings summary
  const headingsSummary = headings.map(h => 
    `${h.level === 1 ? '#' : '##'} ${h.title}`
  ).join('\n');
  
  await fs.writeFile(
    path.join(process.cwd(), 'content/docs/headings-summary.md'),
    headingsSummary
  );
}

async function saveContent(title, content) {
  if (!title || !content) return;
  
  const slug = slugify(title);
  await fs.writeFile(
    path.join(process.cwd(), `content/docs/${slug}.md`),
    content
  );
}

async function main() {
  try {
    console.log('Fetching Notion data...');
    const blocks = await fetchBlockChildren(process.env.NOTION_PAGE_ID);
    
    console.log('Processing blocks and creating files...');
    await processBlocks(blocks);
    
    console.log('Done! Files have been created in the content/docs directory.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();