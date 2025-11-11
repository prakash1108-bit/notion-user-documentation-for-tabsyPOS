import 'dotenv/config';
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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function processBlocks(blocks) {
  const headings = [];
  let currentH1 = null;
  let currentH2 = null;
  let currentContent = '';
  let navigation = [];
  let currentSection = null;
  
  const cleanMarkdown = (text) => {
    return text.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
  };
  
  for (const block of blocks) {
    if (block.type === 'heading_1') {
      // Save previous content if exists
      if (currentH2) {
        await saveContent(currentH2.title, currentH2.content);
      } else if (currentH1) {
        await saveContent(currentH1.title, currentH1.content + currentContent);
      }
      
      if (currentSection) navigation.push(currentSection);
      
      const h1Title = formatRichText(block.heading_1.rich_text);
      currentSection = {
        title: cleanMarkdown(h1Title),
        links: []
      };
      
      currentH1 = {
        title: h1Title,
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
      
      const h2Title = formatRichText(block.heading_2.rich_text);
      if (currentSection) {
        currentSection.links.push({
          title: cleanMarkdown(h2Title),
          href: '/docs/' + slugify(cleanMarkdown(h2Title))
        });
      }
      
      currentH2 = {
        title: h2Title,
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
    await saveContent(currentH1.title, currentH1.content + currentContent);
  }
  
  if (currentSection) navigation.push(currentSection);
  
  // Save headings summary
  const headingsSummary = headings.map(h => 
    `${h.level === 1 ? '#' : '##'} ${h.title}`
  ).join('\n');
  
  await fs.writeFile(
    path.join(process.cwd(), 'src/app/docs/headings-summary.md'),
    headingsSummary
  );
  
  // Save navigation
  const navigationContent = `export const navigation = ${JSON.stringify(navigation, null, 2)}\n`;
  await fs.writeFile(
    path.join(process.cwd(), 'src/lib/navigation.js'),
    navigationContent
  );
}

async function saveContent(title, content) {
  if (!title || !content) return;
  
  const slug = slugify(title);
  const filePath = path.join(process.cwd(), 'src/app/docs', slug, 'page.md');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
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