# Canonical Product Importer

An admin pastes product URLs. The backend scrapes each page, maps the content onto the canonical product schema, and saves it for review. Nothing goes live until the admin approves it.

> **Status: work in progress.** The database layer, URL validation and safe page fetching (robots.txt, blocking of private addresses) are in place. AI extraction, the HTTP API and the frontend screens are still being built.

## Requirements

- Node.js **22.18 or newer** (tested on 24.x). The backend imports Prisma's generated TypeScript client directly, which needs Node's built-in type stripping.
- npm

No API key is needed for the current setup.

## Setup and run

```bash
# 1. Backend: install (also generates the Prisma client), create .env, apply migrations
cd server && npm install && npm run setup

# 2. Frontend: install and start the Vite dev server (http://localhost:5173)
cd ../client && npm install && npm run dev
```

`npm run setup` copies `.env.example` to `.env` if it doesn't exist yet, then applies all migrations to a local SQLite database (`server/dev.db`).

## Backend scripts (`server/`)

| Command | What it does |
| --- | --- |
| `npm run setup` | Create `.env` from `.env.example` and apply migrations |
| `npm run db:generate` | Regenerate the Prisma client (also runs automatically on `npm install`) |
| `npm run db:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create a new migration after editing `schema.prisma` (interactive) |
| `npm run db:status` | Show migration status |
| `npm run db:reset` | Drop the local database and re-apply all migrations (deletes local data) |
| `npm run dev` / `npm start` | Start the API server (entry point not implemented yet) |

## Environment variables

See [`server/.env.example`](server/.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite database file |
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | Runtime mode |

`.env` is git-ignored. Never commit API keys.

## Project structure

```
client/                  React + Vite frontend
server/
  prisma/
    schema.prisma        Data model (canonical snake_case field names)
    migrations/          SQL migrations
  prisma7.config.ts      Prisma config (schema, migrations, datasource)
  generated/prisma/      Generated Prisma client (git-ignored, built on install)
  src/
    config/              env + Prisma client
    constants/           Product, batch, import and proposal statuses
    validators/          URL validation and in-batch de-duplication
    services/
      scraper/           Public-address check, safe fetch, robots.txt, HTML metadata
      product/           Import batch creation
docs/                    Architecture, design decisions, results report
```

## Data model

Field names match the canonical product schema exactly (`sku_id`, `sub_category`, `short_description`, `image_url`, `target_customers` and so on), so the output maps onto the marketplace records without translation.

| Model | Purpose |
| --- | --- |
| `Product` | The canonical product record, with `status` of `DRAFT`, `UNDER_REVIEW` or `ACTIVE` |
| `ImportBatch` | One admin import of one or more URLs, with progress counts |
| `ImportRecord` | One URL inside a batch: status, attempts, error message, extracted data |
| `ProductSource` | Per-field evidence: the value, the supporting text and the URL it came from |
| `ProductUpdateProposal` | Newly scraped values from a refresh, held apart from the live record until the admin decides |

## Scraping safety (implemented)

- HTTP/HTTPS only. URLs with embedded credentials are rejected.
- Hostnames are resolved and rejected if any address is private, loopback or link-local. The connection is pinned to the checked IP, and every redirect is checked again.
- 15 s timeout, 2 MB response limit, at most 5 redirects.
- `robots.txt` is checked first. If it can't be fetched or returns an error, the page is not scraped.

## Assumptions

- A single admin user, so there is no login.
- Only public pages are scraped. Nothing behind a login.
- URLs in a batch are processed one at a time (see [docs/design-decisions.md](docs/design-decisions.md)).

## Known limits (so far)

- Pages that only render with JavaScript are not supported yet. Fetching is plain HTTP.
- Response bodies are decoded as UTF-8.
- Failed requests are not retried yet.
- `npm test` is a placeholder. The `server/src/test-*.js` files are manual scripts for now.
