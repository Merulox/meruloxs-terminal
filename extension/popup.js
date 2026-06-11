function ago(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function until(ms) {
  const s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function setDot(id, state) {
  const el = document.getElementById(id);
  el.className = `dot ${state}`;
}

function setVal(id, text, cls = "") {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `row-value ${cls}`.trim();
}

function formatLogTime(ms) {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLogDetail(detail) {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLogs(logs = []) {
  const el = document.getElementById("log-list");
  const dot = document.getElementById("logs-dot");
  if (!el || !dot) return;

  if (!logs.length) {
    dot.className = "dot warn";
    el.textContent = "empty";
    return;
  }

  dot.className = logs.some((entry) => entry.level === "error") ? "dot err" : "dot ok";
  el.innerHTML = logs.slice(0, 6).map((entry) => {
    const detail = formatLogDetail(entry.detail);
    const message = detail ? `${entry.message} · ${detail}` : entry.message;
    return `
      <div class="log-entry ${entry.level}">
        <div class="meta">${escapeHtml(formatLogTime(entry.time))} · ${escapeHtml(entry.scope)}</div>
        <div class="msg">${escapeHtml(message)}</div>
      </div>
    `;
  }).join("");
}

async function render() {
  // Session check
  const authToken = await chrome.cookies.get({ url: "https://x.com", name: "auth_token" });
  if (authToken) {
    setDot("session-dot", "ok");
    setVal("session-val", "logged in", "ok");
  } else {
    setDot("session-dot", "err");
    setVal("session-val", "not logged in — open x.com", "err");
  }

  // Cache check
  const { tweets_cache } = await chrome.storage.local.get("tweets_cache");
  if (tweets_cache?.tweets?.length) {
    const stale = Date.now() - tweets_cache.fetchedAt > 60 * 60 * 1000;
    setDot("cache-dot", stale ? "warn" : "ok");
    setVal(
      "cache-val",
      `${tweets_cache.tweets.length} tweets · fetched ${ago(tweets_cache.fetchedAt)}`,
      stale ? "warn" : "ok",
    );
  } else {
    setDot("cache-dot", "err");
    setVal("cache-val", "empty", "err");
  }

  // Tweets observed while naturally scrolling the X profile.
  const { tweets_observed } = await chrome.storage.local.get("tweets_observed");
  if (tweets_observed?.tweets?.length) {
    setDot("observed-dot", "ok");
    setVal(
      "observed-val",
      `${tweets_observed.tweets.length} tweets · seen ${ago(tweets_observed.updatedAt)}`,
      "ok",
    );
  } else {
    setDot("observed-dot", "warn");
    setVal("observed-val", "open profile and scroll", "warn");
  }

  // Last attempt
  const { last_attempt } = await chrome.storage.local.get("last_attempt");
  const errorRow = document.getElementById("error-row");

  if (!last_attempt) {
    setDot("fetch-dot", "warn");
    setVal("fetch-val", "never run — click Fetch now", "warn");
    errorRow.style.display = "none";
  } else if (last_attempt.ok) {
    const src = last_attempt.source === "dom" ? "dom scrape" : "api";
    setDot("fetch-dot", "ok");
    setVal("fetch-val", `${last_attempt.count} tweets · ${ago(last_attempt.time)} · ${src}`, "ok");
    errorRow.style.display = "none";
  } else {
    setDot("fetch-dot", "err");
    setVal("fetch-val", ago(last_attempt.time), "err");
    document.getElementById("error-val").textContent = last_attempt.error;
    errorRow.style.display = "flex";
  }

  // Automatic fetch schedule
  const alarm = await chrome.alarms.get("tweet-auto-fetch");
  if (alarm?.scheduledTime) {
    setDot("auto-dot", "ok");
    setVal("auto-val", `hourly · next in ${until(alarm.scheduledTime)}`, "ok");
  } else {
    setDot("auto-dot", "warn");
    setVal("auto-val", "not scheduled — reload extension", "warn");
  }

  // Tweets → static site data
  const { push_status } = await chrome.storage.local.get("push_status");
  if (!push_status) {
    setDot("push-dot", "warn");
    setVal("push-val", "no push yet — click Fetch now", "warn");
  } else if (push_status.ok) {
    setDot("push-dot", "ok");
    setVal("push-val", `pushed ${push_status.count} · ${ago(push_status.time)}`, "ok");
  } else {
    setDot("push-dot", "err");
    setVal("push-val", `${push_status.error} · ${ago(push_status.time)}`, "err");
  }

  // ChatGPT → log bridge
  const { chatgpt_status } = await chrome.storage.local.get("chatgpt_status");
  if (!chatgpt_status) {
    setDot("gpt-dot", "warn");
    setVal("gpt-val", "no sync yet — open chatgpt.com", "warn");
  } else if (chatgpt_status.ok) {
    setDot("gpt-dot", "ok");
    setVal("gpt-val", `${chatgpt_status.count} convos · ${ago(chatgpt_status.time)}`, "ok");
  } else {
    setDot("gpt-dot", "err");
    setVal("gpt-val", `${chatgpt_status.error} · ${ago(chatgpt_status.time)}`, "err");
  }

  const { tweet_seeder_logs } = await chrome.storage.local.get("tweet_seeder_logs");
  renderLogs(tweet_seeder_logs ?? []);

  // Overall dot
  const allOk = authToken && tweets_cache?.tweets?.length && last_attempt?.ok !== false && push_status?.ok === true;
  const anyErr = !authToken || last_attempt?.ok === false || push_status?.ok === false;
  setDot("overall-dot", anyErr ? "err" : allOk ? "ok" : "warn");
}

document.getElementById("refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("refresh-btn");
  btn.disabled = true;
  btn.textContent = "Fetching…";

  chrome.runtime.sendMessage({ action: "fetchTweets" }, async (response) => {
    btn.disabled = false;
    btn.textContent = "Fetch now";
    await render();
  });
});

document.getElementById("clear-logs-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove("tweet_seeder_logs");
  await render();
});

render();
