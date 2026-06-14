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

## X posts → live `/thinking`

The X rail keeps a local archive and also pushes an authenticated merged copy to
Cloudflare KV. `/thinking` polls that live copy every 30 seconds, while the
deployed static JSON remains an offline/error fallback.

```
x.com/merulox tab ──(x_profile.js / Fetch now)──> chrome.storage
        │  tweets: {text, date:"YYYY-MM", url}
        ▼
   background.js ──POST (Bearer token)──> http://localhost:47832/tweets
        │                                           │
        │                                           ▼
        │                                ~/website/src/data/tweets.json
        ▼
   https://merulox.com/api/tweets ──> Cloudflare KV ──> /thinking polling
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
While you browse and scroll `x.com/merulox`, a profile content script continuously
collects each rendered post before X virtualizes it out of the DOM. Manual and
hourly fetches merge those observations with the automated background scrape,
deduplicate by post URL, and keep the newest 100.
For replies to posts outside the profile timeline, up to five preceding
conversation posts are retained as display context. Self-thread continuations are
resolved from X's ascending adjacent timeline grouping. External replies keep
polling their permalink after the `Replying to` label appears so the asynchronously
loaded parent post is captured too. If X does not render the parent chain, the
extension falls back to public FxTwitter metadata.

While you browse the X profile, newly observed posts are pushed after a short
debounce. Manual and hourly full scrapes also push to both destinations. The
cloud endpoint merges by URL and never treats a partial scrape as a replacement.

Click **Fetch now** in the extension popup to force an immediate refresh. The
**tweets → site** row should go green after the receiver writes
`src/data/tweets.json`.

When deleting one of your posts on X, the extension marks X's delete controls
with a blue `site sync` badge. Clicking X's final delete confirmation also
tombstones the post in Cloudflare KV, removes it from the local archive, and
clears it from extension caches so later scrapes cannot restore it.

For a post that was already deleted on X, find its still-published link on
`/thinking` and paste that URL (or only its numeric status ID) into the extension
popup's **Remove from site** field. Tombstones are durable:

- Live tombstones are stored alongside the `tweets` key in Cloudflare KV.
- Local tombstones are stored at
  `~/.local/share/tweet-seeder/tombstones.json`.

Freshness is normally under 45 seconds after the extension observes a post:
10-second extension debounce plus the writing page's 30-second polling interval.
The Pages `LOG_KV_TOKEN` secret matches `extension/config.local.js` and the local
receiver token.

## Troubleshooting

- Popup row red with `Failed to fetch` → receiver not running
  (`systemctl --user restart log-ingest-receiver`).
- Popup row red with `401` → token mismatch between `config.local.js` and
  `~/.secrets/log-ingest-token.txt`.
- Row stays "no sync yet" → you haven't opened chatgpt.com logged-in since loading
  the extension, or the 30-min throttle hasn't elapsed.
- **auto fetch** says "not scheduled" → reload the extension from
  `chrome://extensions` so the current manifest and alarms permission take effect.
