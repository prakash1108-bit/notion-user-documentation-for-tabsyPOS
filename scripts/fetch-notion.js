/**
 * Notion Documentation Fetcher
 * 
 * This script fetches documentation content from a Notion page and converts it into 
 * Markdown files for a Next.js documentation site. It processes the Notion page's 
 * block structure hierarchically and generates individual page files along with 
 * navigation data.
 * 
 * OVERVIEW:
 * The script connects to the Notion API, retrieves all blocks (content elements) from
 * a specified Notion page, and transforms them into a structured documentation website.
 * It handles the entire documentation generation pipeline from fetch to file creation.
 * 
 * MAIN WORKFLOW:
 * 1. Authenticates with Notion API using an integration token
 * 2. Fetches all blocks from a Notion page (including nested children)
 * 3. Converts Notion blocks to Markdown format
 * 4. Organizes content based on heading hierarchy (H1 and H2)
 * 5. Creates separate Markdown files for each documentation section
 * 6. Generates a navigation structure for the website
 * 
 * CONTENT ORGANIZATION:
 * - H1 headings define major sections (top-level navigation items)
 * - H2 headings define sub-sections (individual documentation pages)
 * - Each H2 becomes its own page file under /src/app/docs/[slug]/page.md
 * - Content under H2s includes all subsequent blocks until the next heading
 * - Navigation structure mirrors the H1/H2 hierarchy
 * 
 * OUTPUT:
 * - Individual Markdown files: src/app/docs/[slug]/page.md
 * - Navigation file: src/lib/navigation.js (exported navigation array)
 * 
 * DEPENDENCIES:
 * - @notionhq/client: Official Notion JavaScript SDK
 * - dotenv: Environment variable management
 * - fs/promises: Node.js file system operations
 * - path: Node.js path utilities
 * 
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NOTION_TOKEN: Notion integration token for API authentication
 * - NOTION_PAGE_ID: The ID of the Notion page to fetch content from
 */

import 'dotenv/config';
import { Client } from '@notionhq/client';
import fs from 'fs/promises';
import path from 'path';

// Initialize the Notion client with authentication token from environment variables
const notion = new Client({ auth: process.env.NOTION_TOKEN });


/**
 * Recursively fetches all child blocks from a given Notion block
 * 
 * This function handles pagination automatically when fetching blocks from Notion,
 * as Notion API returns results in pages. It also recursively fetches children for
 * any blocks that contain nested content (like toggle lists, columns, etc.).
 * 
 * PAGINATION HANDLING:
 * - Uses start_cursor to handle paginated results
 * - Continues fetching until has_more is false
 * - Concatenates all results into a single array
 * 
 * RECURSIVE CHILDREN:
 * - Checks each block's has_children property
 * - If true, recursively fetches and attaches children blocks
 * - Children are stored in a 'children' property on the block object
 * 
 * @param {string} blockId - The UUID of the Notion block to fetch children from
 * @returns {Promise<Array>} Array of block objects with their nested children
 */
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

/**
 * Formats Notion rich text objects into Markdown text
 * 
 * Notion stores text with rich formatting as an array of rich text objects.
 * Each object contains plain text and annotation properties (bold, italic, etc.).
 * This function converts those annotations into Markdown syntax.
 * 
 * SUPPORTED ANNOTATIONS:
 * - Bold: Wrapped in ** **
 * - Italic: Wrapped in * *
 * - Strikethrough: Wrapped in ~~ ~~
 * - Code: Wrapped in ` `
 * - Links: Converted to [text](url) format
 * 
 * @param {Array} richTextArray - Array of Notion rich text objects
 * @returns {string} Formatted Markdown string with all annotations applied
 */
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

/**
 * Converts a single Notion block into Markdown format
 * 
 * Notion content is structured as blocks, where each block has a type (heading,
 * paragraph, list, code, etc.). This function maps each block type to its
 * corresponding Markdown syntax.
 * 
 * SUPPORTED BLOCK TYPES:
 * - heading_1: # Heading (H1)
 * - heading_2: ## Heading (H2)
 * - paragraph: Plain text with double newline
 * - bulleted_list_item: * List item
 * - numbered_list_item: 1. List item
 * - code: ```language code ```
 * - quote: > Quote text
 * - divider: Horizontal rule (---)
 * - image: ![caption](url)
 * - default: Attempts to extract and format any rich_text property
 * 
 * IMAGES:
 * - Handles both external URLs and Notion-hosted files
 * - Extracts captions if available, defaults to "Image"
 * 
 * @param {Object} block - A Notion block object
 * @returns {string} Markdown-formatted string representation of the block
 */
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

/**
 * Converts text into a URL-friendly slug
 * 
 * Creates slugs for file paths and URLs by converting text to lowercase,
 * replacing non-alphanumeric characters with hyphens, and removing leading/trailing hyphens.
 * 
 * TRANSFORMATION RULES:
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Strips leading and trailing hyphens
 * 
 * EXAMPLES:
 * - "Quick Start Guide" → "quick-start-guide"
 * - "API Reference (v2)" → "api-reference-v2"
 * - "What's New?" → "what-s-new"
 * 
 * @param {string} text - The text to convert into a slug
 * @returns {string} URL-friendly slug
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Processes all blocks and organizes them into documentation pages
 * 
 * This is the core processing function that orchestrates the entire conversion
 * from Notion blocks to documentation files. It implements a state machine that
 * tracks the current position in the heading hierarchy and accumulates content
 * for each documentation page.
 * 
 * HIERARCHICAL PROCESSING:
 * - H1 headings create new top-level sections in navigation
 * - H2 headings create individual documentation pages
 * - Content between headings is accumulated and assigned to the appropriate page
 * - Each H2 page includes the content of its parent H1 heading
 * 
 * STATE TRACKING:
 * - currentH1: The current top-level section being processed
 * - currentH2: The current sub-section (individual page) being processed
 * - currentContent: Accumulated content between headings
 * - currentSection: Current navigation section being built
 * 
 * FILE CREATION:
 * - Each H2 heading triggers saving the previous page
 * - Content includes the H1 heading, H2 heading, and all following blocks
 * - Files are saved to src/app/docs/[slug]/page.md
 * 
 * NAVIGATION STRUCTURE:
 * - Built as an array of section objects
 * - Each section has a title (from H1) and links array (from H2s)
 * - Each link has a title and href (generated from slug)
 * - Saved to src/lib/navigation.js as an exported constant
 * 
 * MARKDOWN CLEANING:
 * - Removes markdown formatting from navigation titles
 * - Ensures clean display in navigation menus
 * - Preserves formatting in actual page content
 * 
 * @param {Array} blocks - Array of Notion block objects to process
 * @returns {Promise<void>} Resolves when all files are created
 */
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
  
  // Save navigation
  const navigationContent = `export const navigation = ${JSON.stringify(navigation, null, 2)}\n`;
  await fs.writeFile(
    path.join(process.cwd(), 'src/lib/navigation.js'),
    navigationContent
  );
}

/**
 * Saves content to a Markdown file with appropriate folder structure
 * 
 * Creates the necessary directory structure and writes the Markdown content
 * to a file named page.md within a folder named after the slugified title.
 * 
 * FILE STRUCTURE:
 * - Path: src/app/docs/[slug]/page.md
 * - [slug] is generated from the heading title
 * - Directories are created recursively if they don't exist
 * 
 * VALIDATION:
 * - Skips saving if title or content is empty/null
 * - Prevents creating empty documentation pages
 * 
 * @param {string} title - The heading title (used to generate the slug)
 * @param {string} content - The Markdown content to write to the file
 * @returns {Promise<void>} Resolves when the file is written
 */
async function saveContent(title, content) {
  if (!title || !content) return;
  
  const slug = slugify(title);
  const filePath = path.join(process.cwd(), 'src/app/docs', slug, 'page.md');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

/**
 * Main execution function
 * 
 * Entry point for the script that orchestrates the entire documentation
 * generation process. Handles the high-level workflow and error management.
 * 
 * EXECUTION FLOW:
 * 1. Logs start message
 * 2. Fetches all blocks from the Notion page (with pagination and recursion)
 * 3. Processes blocks into Markdown files and navigation
 * 4. Logs success message
 * 5. Handles any errors and exits with error code if needed
 * 
 * ERROR HANDLING:
 * - Catches and logs any errors during execution
 * - Exits with code 1 on failure for CI/CD integration
 * - Provides clear error messages for debugging
 * 
 * USAGE:
 * Run with: node scripts/fetch-notion.js
 * Requires NOTION_TOKEN and NOTION_PAGE_ID environment variables
 * 
 * @returns {Promise<void>} Resolves when documentation generation completes
 */
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