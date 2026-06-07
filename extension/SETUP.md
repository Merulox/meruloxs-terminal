# ChatGPT → build-log bridge — setup

How live ChatGPT history reaches the `/log` generator. Fully local — conversation
titles never leave your machine.

```
chatgpt.com tab ──(chatgpt_history.js)──> backend-api/conversations
        │  titles + update_time
        ▼
   background.js ──POST (Bearer token)──> http://localhost:47832/chatgpt
                                                    │  (log-ingest-receiver, systemd --user)
                                                    ▼
                               ~/.local/share/log-digest/conversations.json
                                                    │
   ~/scripts/log-digest ──reads the file───────────┘
```

There is no official ChatGPT history API, so the extension uses the app's own
backend from a logged-in tab (the session cookie authorizes it — no token to
paste or rotate). The local receiver is the rendezvous between the browser and
the local `log-digest` script.

## The shared secret

One token authorizes the POST to the local receiver. It already exists in both
places that need it:

- `extension/config.local.js` → `LOG_INGEST_TOKEN` (gitignored)
- `~/.secrets/log-ingest-token.txt` (read by the receiver)

Nothing to configure in the cloud.

## 1. The receiver (already running)

`log-ingest-receiver` runs as a systemd `--user` service on `127.0.0.1:47832`.
Verify:

```sh
systemctl --user status log-ingest-receiver     # active (running)
curl -s http://localhost:47832/                 # {"status":"ok"}
```

## 2. Load the extension (one-time, Chrome)

`chrome://extensions` → Developer mode → **Load unpacked** → select
`~/website/extension`. (If already loaded for the X feed, click **Reload** so the
new ChatGPT permissions + localhost host take effect.)

## 3. Harvest

Open `chatgpt.com` while logged in. The content script pulls your recent
conversation titles (at most once / 30 min) and POSTs them to the local receiver.
Check the extension popup — the **chatgpt → log** row should go green with a count.

## 4. log-digest picks it up

Already wired: `log-digest` reads `~/.local/share/log-digest/conversations.json`
by default. Confirm:

```sh
log-digest --print   # the "CHATGPT HISTORY" block lists recent titles
```

Only conversation *titles* + timestamps are ever read, they stay on this machine,
and the summarize+sanitize Claude call strips anything sensitive before it reaches
the public log.

## X posts → static `/thinking`

The X rail uses the same local-first shape as the log data: scrape locally, write a
local JSON file, then bake it into the static Astro build.

```
x.com/merulox tab ──(x_profile.js / Fetch now)──> chrome.storage
        │  tweets: {text, date:"YYYY-MM", url}
        ▼
   background.js ──POST (Bearer token)──> http://localhost:47832/tweets
                                                    │  (log-ingest-receiver, systemd --user)
                                                    ▼
                         ~/website/src/data/tweets.json
                                                    │
   npm run deploy ──Astro imports JSON─────────────┘
                                                    ▼
                         static HTML on /thinking
```

After changing `log-ingest-receiver`, restart the user service:

```sh
systemctl --user restart log-ingest-receiver
```

The extension fetches automatically once per hour while the browser is running.
It opens the replies-inclusive profile in a background tab, scrolls until it has
up to 30 posts, resolves new posts against their permalink conversation, pushes
them to the local receiver, then closes the tab. Permalink results are cached as
authoritative reply metadata so timeline scrapes cannot invent or erase replies.
For replies to posts outside the profile timeline, up to five preceding
conversation posts are retained as display context. Self-thread continuations are
resolved from X's ascending adjacent timeline grouping. External replies keep
polling their permalink after the `Replying to` label appears so the asynchronously
loaded parent post is captured too.

The public writing page always renders deployed static data. The extension no
longer overlays browser-local tweet cache data onto merulox.com.

Click **Fetch now** in the extension popup to force an immediate refresh. The
**tweets → site** row should go green after the receiver writes
`src/data/tweets.json`.

Freshness is deploy-cadenced: new tweets become public on the next
`npm run deploy`, not instantly. There is no cloud config, KV, Pages Function, or
new secret; this reuses `LOG_INGEST_TOKEN` / `~/.secrets/log-ingest-token.txt`.

## Troubleshooting

- Popup row red with `Failed to fetch` → receiver not running
  (`systemctl --user restart log-ingest-receiver`).
- Popup row red with `401` → token mismatch between `config.local.js` and
  `~/.secrets/log-ingest-token.txt`.
- Row stays "no sync yet" → you haven't opened chatgpt.com logged-in since loading
  the extension, or the 30-min throttle hasn't elapsed.
- **auto fetch** says "not scheduled" → reload the extension from
  `chrome://extensions` so the current manifest and alarms permission take effect.
