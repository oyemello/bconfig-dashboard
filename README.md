AMEX Banking Config Dashboard
================================

A Next.js dashboard that visualizes workbook data from Excel files. It supports dark/light mode, an AI chat-based search experience, and multi-select row highlighting. For GitHub Pages, data is prebuilt to JSON so the site can be fully static while the UI and behavior remain the same.

Features
- Excel-backed data (no DB). Reads local `.xlsx` files.
- AI chat-based search in a right-side drawer, with in-memory context until refresh.
- Optional cross‑workbook scope toggle (search across BC, CC, CS at once).
- Results formatted with Workbook, Title (sheet), Label, Description.
- Sticky table header; vertical and horizontal scrolling in the data area.
- Multi-select rows with click-to-toggle and "Uncheck all" action.
- Left column: vertical-only scroll; selected sheet highlighted.
- Theme toggle (light/dark) with custom palette.

Project Structure
- `lib/excel/files.ts` — product→workbook mapping + labels.
- `lib/excel/parse.ts` — Excel parsing utilities.
- `app/page.tsx` — main UI (AI drawer + table), data fetch (API in dev, JSON on Pages).
- `app/api/ai/route.ts` — AI search route (OpenAI Chat Completions).
- `scripts/build-data.mjs` — build-time JSON generator for Pages.
- `.github/workflows/pages.yml` — GitHub Pages workflow.

Excel Mapping (swap workbooks)
Update the paths in `lib/excel/files.ts:4` to point to your desired `.xlsx` files:

```
export const PRODUCT_FILES = {
  BC: 'excel-data/BS-8WW.xlsx', // Business Checking
  CC: 'excel-data/CC-LO7.xlsx', // Consumer Checking
  CS: 'excel-data/CS.xlsx',     // Consumer Savings
}
```

After changing these, rebuild (see below). The UI updates automatically.

Parsing Rules (how sheets are read)
- Determine the used range of the worksheet, then extend by +3 rows and +3 columns.
- Header row is row 1; blank headers are named `Column N`.
- Blank cells render as a hyphen (`-`).
- Record count = number of data rows (excluding the header) that have at least one non-empty cell within the original used range.

Local Development (API mode)
Runs with live Excel parsing via API routes (and the AI route).

```
# Install deps
npm ci

# Start dev server (requires OPENAI_API_KEY for AI chat)
npm run dev
```

- Data is served by `app/api/index/route.ts`, `app/api/sheet/route.ts`, and `app/api/ai/route.ts` (OpenAI-backed).
- The UI fetches these endpoints during development.

Static Build for GitHub Pages
GitHub Pages is static-only. The workflow builds JSON from the Excel files, then builds a static site with `output: 'export'`.
Note: API routes (including AI chat) are not available on Pages; the AI drawer is intended for dev/server deployments.

Locally (optional):
```
# Generate JSON under public/data/
NEXT_PUBLIC_PAGES=1 npm run build:data

# Build static site (outputs to ./out)
NEXT_PUBLIC_PAGES=1 npm run build
```

CI (recommended):
- On push to `main`, the workflow will:
  1) `NEXT_PUBLIC_PAGES=1 npm run build:data`
  2) Remove `app/api` (APIs not supported on Pages)
  3) `NEXT_PUBLIC_PAGES=1 npm run build`
  4) Deploy `out/` to GitHub Pages

Notes
- `next.config.mjs` switches to static export and sets `basePath`/`assetPrefix` to `/bconfig-dashboard` only when `NEXT_PUBLIC_PAGES=1`.
- In static mode, the UI fetches `public/data/*.json` instead of API routes (automatic via `NEXT_PUBLIC_PAGES`).
- AI chat requires a server environment (or a separate API) to access OpenAI.

AI Search
- Click "Search with AI" to open the chat drawer. Ask for fields or descriptions.
- The backend ranks rows giving extra weight to “Screen Label” and “Additional Field Description” columns when present.
- Use the Scope switch to search the selected product only or all workbooks (BC, CC, CS).
- When confident, the assistant returns:
  - "Here's what you might be looking for:\nWorkbook: …\nTitle: …\nLabel: …\nDescription: …"

UI Details
- Left column: fixed width; vertical scroll only; selected item background `#006fcf` with white text.
- Right column: sticky header row with `#f7f8f9` background and `#006fcf` text.
- Row selection: click toggles selection; multiple rows can be selected; selected rows use `#ecedee` with `#333333` text; hover does not change state.

Troubleshooting
- If Pages deploy fails with API-related errors, ensure the workflow step that removes `app/api` runs before the Pages build.
- If static site assets 404 under GitHub Pages, verify `basePath`/`assetPrefix` are `/bconfig-dashboard` (set by `NEXT_PUBLIC_PAGES=1`).
- After changing Excel files, run the data build step again to regenerate `public/data/*.json`.
- OpenAI errors:
  - 401 unauthorized → invalid/expired key.
  - 404 model not found → set `OPENAI_MODEL=gpt-4o` or `gpt-4o-mini`.
  - 429 insufficient_quota → fund the account or use a funded key.

Scripts
- `npm run dev` — dev server with APIs (live parsing).
- `npm run build` — production build (no export) for server environments.
- `npm run build:data` — generate JSON datasets in `public/data`.
- `NEXT_PUBLIC_PAGES=1 npm run build` — static export to `out/` for GitHub Pages (after `build:data`).

Deployment
- Main branch pushes trigger the GitHub Pages workflow (`.github/workflows/pages.yml`).
- Configure GitHub Pages → Source: GitHub Actions.

Maintainer tips
- To add a new product type, update the union and maps in `lib/excel/files.ts`, the labels/select in `app/page.tsx`, and optionally accent colors.
- Keep `scripts/build-data.mjs` in sync with `lib/excel/parse.ts` if parsing rules evolve.

OpenAI Setup
- Create `.env.local` with:
  - `OPENAI_API_KEY=sk-...` (required)
  - `OPENAI_MODEL=gpt-4o-mini` (optional; defaults to `gpt-4o-mini`)
  - `OPENAI_ORG=org_...` (optional; if using organizations)
- Restart `npm run dev` after changes to env vars.
