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

## Troubleshooting

- Popup row red with `Failed to fetch` → receiver not running
  (`systemctl --user restart log-ingest-receiver`).
- Popup row red with `401` → token mismatch between `config.local.js` and
  `~/.secrets/log-ingest-token.txt`.
- Row stays "no sync yet" → you haven't opened chatgpt.com logged-in since loading
  the extension, or the 30-min throttle hasn't elapsed.
