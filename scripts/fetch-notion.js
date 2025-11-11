/**
 * Notion Documentation Fetcher
 * 
 * This script fetches documentation content from a Notion page and converts it into 
 * Markdown files for a Next.js documentation site. It processes the Notion page's 
 * block structure hierarchically and generates individual page files along with 
 * navigation data.
 */

import 'dotenv/config';
import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'fs/promises';
import path from 'path';

// Initialize the Notion client with authentication token from environment variables
const notion = new Client({ auth: process.env.NOTION_TOKEN });

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function processMarkdown(mdString) {
  if (typeof mdString === 'object' && mdString.parent) {
    mdString = mdString.parent;
  }
  const lines = mdString.split('\n');
  const headings = [];
  let currentH1 = null;
  let currentH2 = null;
  let currentContent = '';
  let navigation = [];
  let currentSection = null;
  
  const cleanMarkdown = (text) => {
    return text.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('# ')) {
      if (currentH2) {
        await saveContent(currentH2.title, currentH2.content);
      } else if (currentH1) {
        await saveContent(currentH1.title, currentH1.content + currentContent);
      }
      
      if (currentSection) navigation.push(currentSection);
      
      const h1Title = line.substring(2).trim();
      currentSection = {
        title: cleanMarkdown(h1Title),
        links: []
      };
      
      currentH1 = {
        title: h1Title,
        content: line + '\n\n'
      };
      currentH2 = null;
      currentContent = '';
      headings.push({ level: 1, title: currentH1.title });
    } else if (line.startsWith('## ')) {
      if (currentH2) {
        await saveContent(currentH2.title, currentH2.content);
      }
      
      const h2Title = line.substring(3).trim();
      if (currentSection) {
        currentSection.links.push({
          title: cleanMarkdown(h2Title),
          href: '/docs/' + slugify(cleanMarkdown(h2Title))
        });
      }
      
      currentH2 = {
        title: h2Title,
        content: (currentH1 ? currentH1.content : '') + line + '\n\n'
      };
      currentContent = '';
      headings.push({ level: 2, title: currentH2.title });
    } else {
      if (currentH2) {
        currentH2.content += line + '\n';
      } else if (currentH1) {
        currentContent += line + '\n';
      }
    }
  }
  
  if (currentH2) {
    await saveContent(currentH2.title, currentH2.content);
  } else if (currentH1) {
    await saveContent(currentH1.title, currentH1.content + currentContent);
  }
  
  if (currentSection) navigation.push(currentSection);
  
  const headingsSummary = headings.map(h => 
    `${h.level === 1 ? '#' : '##'} ${h.title}`
  ).join('\n');
  
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
    const n2m = new NotionToMarkdown({ notionClient: notion });
    const mdblocks = await n2m.pageToMarkdown(process.env.NOTION_PAGE_ID);
    const mdString = n2m.toMarkdownString(mdblocks).parent;
    
    console.log('Processing markdown and creating files...');
    await processMarkdown(mdString);
    
    console.log('Done! Files have been created in the content/docs directory.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();