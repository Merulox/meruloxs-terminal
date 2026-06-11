# merulox.com

Source for [merulox.com](https://merulox.com) — a personal site that auto-logs what I'm building.

Built with Astro, deployed on Cloudflare Pages.

## Pages

| | |
|---|---|
| `/log` | Daily build log — auto-generated nightly from Claude + ChatGPT session history |
| `/music` | Last.fm listening history, pulled and rendered on deploy |
| `/reading` | Book tree synced from Kobo device |
| `/stack` | Tools in use |
| `/thinking` | Notes |
| `/work` | Projects |

## How the log works

A systemd timer (`log-digest`) runs nightly. It pulls Claude conversation titles, ChatGPT history (via browser extension in `/extension/`), Last.fm scrobbles, and any other signals — summarizes them, sanitizes, and appends to `log.json`. Cloudflare Pages redeploys on push.

The extension captures ChatGPT session titles and POSTs them to a local receiver that `log-digest` reads at run time.

## Deploy

```bash
npm run build    # Astro build
npm run deploy   # wrangler pages deploy
```

Or push to main — Cloudflare Pages picks it up automatically.
