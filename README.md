# merulox.com

Personal site. Dark, monospace, no JavaScript frameworks.

## Pages

| Route | What it is |
|-------|-----------|
| `/` | Index — links out to everything |
| `/work` | Active and shipped projects with state indicators |
| `/thinking` | X posts and threads, scraped and rendered locally |
| `/reading` | Book list reconciled with local Kobo ownership data |
| `/music` | Last.fm listening data |
| `/log` | Session logs |
| `/employers` | Separate section: approach, projects, momentum, contact |

## Stack

Astro · Cloudflare Pages · Cloudflare Workers (API routes) · browser extension for X post scraping · Last.fm API · JSON content files

## Commands

```sh
npm install
npm run dev
npm run build
npm run deploy
```

`dev.merulox.com` is protected by HTTP Basic authentication. Configure the
Cloudflare Pages secrets `DEV_AUTH_USER` and `DEV_AUTH_PASSWORD` for preview
deployments; production hosts remain public.

## Repo layout

- `src/pages/` — all routes
- `src/data/` — tweets.json, books, other content state
- `functions/api/` — Cloudflare Workers: tweets, feed, summarize, artist-image
- `extension/` — browser extension (X post capture)
