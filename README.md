# Notion Documentation To Website

This project automatically converts your Notion documentation into a beautiful, searchable Next.js website. It fetches content from a Notion page and generates a documentation site with automatic navigation, search functionality, and responsive design.

## How It Works

### Content Fetching & Display

1. **Fetch from Notion**: The `fetch-notion` script connects to your Notion workspace using the Notion API
2. **Parse Content**: Converts Notion blocks (headings, paragraphs, lists, code blocks, images, etc.) into Markdown format
3. **Generate Structure**: Automatically creates:
   - Individual page files for each section (H2 headings)
   - Navigation structure based on your content hierarchy
   - Searchable index for the global search feature
4. **Display**: Next.js renders the Markdown content with syntax highlighting, responsive design, and interactive components

## Environment Variables (.env)

Create a `.env` file in the root directory with the following required keys. You can copy the example file provided (`.env.example`) and update the values:

```bash
# Required: Your Notion Integration Token
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Required: The ID of your Notion page (documentation root page)
NOTION_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Ideal Notion Structure

For best results, structure your Notion documentation page as follows:

### ✅ Recommended Structure:

```
📄 Your Documentation Page (This is the page you'll use as NOTION_PAGE_ID)
  
    # Main Heading 1 (Heading 1)

        ## Sub-heading 1
            Content for topic 1...
            - Bullet points
            - Code blocks
            - Images

        ## Sub-heading 2
            Content for topic 1...
            - Bullet points
            - Code blocks
            - Images

    # Main Heading 2 (Heading 1)

        ## Sub-heading 1
            Content for topic 1...
            - Bullet points
            - Code blocks
            - Images

        ## Sub-heading 2
            Content for topic 1...
            - Bullet points
            - Code blocks
            - Images
```

### For the Documentation

- [User Documentation for TabyPOS](https://toothsome-brazil-8f4.notion.site/User-Documentation-For-TabyPOS-29a733089d918041a179d54da8c1187a)
- Refer to this documentation for an overview of the structure.

### Navigation Generation Rules:

- **Heading 1 (H1)**: Creates a section in the navigation sidebar
- **Heading 2 (H2)**: Creates individual documentation pages under the H1 section
  - Each H2 becomes a clickable link in the navigation
  - The H2 title is used for the page title and URL slug
  - URL format: `/docs/topic-name-slugified`

### Supported Notion Blocks:

- ✅ Headings (H1, H2, H3)
- ✅ Paragraphs with rich text (bold, italic, strikethrough, code, links)
- ✅ Bulleted lists
- ✅ Numbered lists
- ✅ Code blocks (with language syntax highlighting)
- ✅ Quotes
- ✅ Images (external and uploaded)
- ✅ Dividers

## Getting started

To get started with this template, first install the npm dependencies:

```bash
npm install
```

### Fetch Content from Notion

Before running the development server, fetch your Notion content:

```bash
npm run fetch-notion
```

This command will:
- Connect to your Notion workspace
- Fetch all content from the specified page
- Generate Markdown files in `src/app/docs/`
- Create navigation structure in `src/app/docs/navigation.json`

**Note**: Run this command whenever you update your Notion documentation to sync changes.

### Run Development Server

Next, run the development server:

```bash
npm run dev
```

Finally, open [http://localhost:3000](http://localhost:3000) in your browser to view the website.

## Global search

This template includes a global search that's powered by the [FlexSearch](https://github.com/nextapps-de/flexsearch) library. It's available by clicking the search input or by using the `⌘K` shortcut.

This feature requires no configuration, and works out of the box by automatically scanning your documentation pages to build its index. You can adjust the search parameters by editing the `/src/markdoc/search.mjs` file.

## Workflow

1. **Create/Update Documentation in Notion**: Write and organize your documentation
2. **Run Fetch Script**: `npm run fetch-notion` to sync content
3. **Review Changes**: Check generated files in `src/app/docs/`
4. **Deploy**: Build and deploy your site with `npm run build` && `npm start`

## Learn more

To learn more about the technologies used in this site template, see the following resources:

- [Tailwind CSS](https://tailwindcss.com/docs) - the official Tailwind CSS documentation
- [Next.js](https://nextjs.org/docs) - the official Next.js documentation
- [Headless UI](https://headlessui.dev) - the official Headless UI documentation
- [Markdoc](https://markdoc.io) - the official Markdoc documentation
- [Algolia Autocomplete](https://www.algolia.com/doc/ui-libraries/autocomplete/introduction/what-is-autocomplete/) - the official Algolia Autocomplete documentation
- [FlexSearch](https://github.com/nextapps-de/flexsearch) - the official FlexSearch documentation
- [Notion API](https://developers.notion.com/) - the official Notion API documentation
- [Syntax Template](https://tailwindcss.com/plus/templates/syntax/preview) - the Syntax site template
