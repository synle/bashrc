# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nav Generator is a client-side React application that converts bookmark lists into self-contained data URLs that can be bookmarked in browsers. The entire application runs in the browser with no backend dependencies.

## Development Commands

### Building
```bash
npm run build          # Production build using Vite
./build.sh            # Alternative build script
```

The build outputs directly to the root directory:
- `index.js` - Compiled JavaScript bundle (IIFE format)
- `index.css` - Compiled styles from SCSS
- `index.js.map` - Source map

### Local Development
```bash
npm start             # Start HTTP server with CORS support (port 8080)
./dev.sh             # Watch mode - auto-rebuilds on file changes every 3 seconds
```

### Code Formatting
```bash
npm run format        # Format HTML, JSX, SCSS, YML, MD, JSON files with Prettier
```

## Architecture

### Single-File React Application

The entire application is contained in `index.jsx` (~3,300 lines), structured as:

1. **Modal System** (lines 36-252)
   - Custom Modal, AlertModal, PromptModal components
   - Override native `window.alert()`, `window.confirm()`, `window.prompt()`
   - Modal manager for rendering/unmounting modals

2. **Schema Parser** (lines 315-750)
   - Parses custom bookmark syntax into structured data
   - Syntax markers:
     - `!` - Page title
     - `#` - Section headers
     - `|` - Same-tab links
     - `|||` - New-tab links
     - `` ``` `` - Code blocks
     - `---` - HTML blocks
     - `>>>` - Tabs
     - `@` - Custom favicon URLs

3. **Core Components** (lines 750-2800)
   - `SearchBox` - Fuzzy search with keyboard navigation
   - `PageRead` - View mode for rendered navigation
   - `PageEdit` - Edit mode with schema editor
   - `SchemaRender` - Converts parsed schema to React elements
   - `SchemaEditor` - Monaco Editor wrapper with textarea fallback
   - `App` - Main application component with view mode routing
   - `PageVersionHistory` - IndexedDB-based version history
   - `PageChromeBookmarkImport` - Import Chrome bookmarks
   - `PageChromeBookmarkExport` - Export as Chrome bookmarks
   - `PageBackupDownload` - Download schema as file

4. **Utilities** (lines 2800-3291)
   - Theme toggle (dark/light mode stored in localStorage)
   - IndexedDB operations for version history
   - Data URL generation and navigation
   - Bookmark file parsing (Chrome format)

### Service Worker (`sw-nav.js`)

Implements stale-while-revalidate caching strategy:
- Cache version tied to build timestamp (injected during build)
- 1-week TTL for cached resources
- Caches: HTML, JS, CSS, images, and specific file types
- Auto-updates and cleans expired cache entries

### Build Configuration (`vite.config.js`)

- Custom plugin `updateServiceWorker()` injects build timestamp into service worker
- Outputs IIFE bundle (not ES modules) to root directory
- Source maps enabled
- SCSS preprocessing
- Minification enabled for production

### Styling (`index.scss`, `common.scss`)

- SCSS with shared variables in `common.scss`
- Custom elements: `<load>`, `<tabs>`, `<tab>`
- Theme variables for dark/light modes
- Responsive design

### Generated Output

The build creates a data URL embedded in `index.html` that contains:
- Entire navigation schema in `<script type='schema'>` tag
- Self-contained HTML that loads CSS and JS from GitHub Pages
- Can be bookmarked directly in the browser

## Key Concepts

### Data URL Architecture
The application generates self-contained data URLs that:
1. Load external CSS/JS from GitHub Pages (`https://synle.github.io/nav-generator/`)
2. Embed the navigation schema inline in a `<script type='schema'>` tag
3. Can be bookmarked and work offline (after first load via service worker)

### Schema Language
The custom markup language is intentionally minimal for easy typing in the editor. The parser (`_parseSchemaString` function) converts this to a structured format for rendering.

### Monaco Editor Integration
- Loads Monaco from CDN (`https://unpkg.com/monaco-editor@0.40.0`)
- Custom syntax highlighting for nav-generator schema
- Falls back to textarea if Monaco fails to load within 5 seconds
- Auto-formats with word wrap and minimap disabled

### Version History
- Uses IndexedDB (`VersionsDB`) to store schema snapshots
- Auto-saves on each edit (deduplicated by value)
- Restore previous versions via dedicated page

## CI/CD

GitHub Actions workflow (`.github/workflows/build-main.yml`):
- Triggers on push to main/master
- Calls reusable workflow from `synle/gha-workflow`
- Runs `build.sh` and commits artifacts back to repository
- Allows direct deployment to GitHub Pages

## Important Notes

- **No tests**: This project has no test suite
- **Single file**: Most application logic is in one large `index.jsx` file, not split into modules
- **Build outputs to root**: Unlike typical projects, build artifacts are committed to the root directory for GitHub Pages deployment
- **Monaco timeout**: The editor has a 5-second timeout before falling back to textarea
- **Custom HTML elements**: Uses non-standard elements like `<load>`, `<tabs>`, `<tab>` for styling purposes
- **eval() usage**: JavaScript links (`javascript://`) use eval() for execution (line 1585)
- **No TypeScript**: Pure JavaScript/JSX without type checking
