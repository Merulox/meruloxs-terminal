function ago(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
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

  // Overall dot
  const allOk = authToken && tweets_cache?.tweets?.length && last_attempt?.ok !== false;
  const anyErr = !authToken || last_attempt?.ok === false;
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

render();
