import assert from "node:assert/strict";
import test from "node:test";
import { onRequestDelete, onRequestPatch, onRequestPost } from "../functions/api/tweets.js";

const urls = {
  stale: "https://x.com/merulox/status/1",
  media: "https://x.com/merulox/status/2",
  invalid: "https://x.com/merulox/status/3",
  external: "https://x.com/merulox/status/4",
};

function requestContext(kv, method, body) {
  return {
    env: { LIVE_TWEETS: kv, LOG_KV_TOKEN: "test-token" },
    request: new Request("https://site.test/api/tweets", {
      method,
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  };
}

test("tweet ingest preserves media, rejects incomplete replies, clears stale metadata, and retries collisions", async () => {
  let state = {
    tweets: [{ text: "quote", url: urls.stale, threadResolved: true, threadVersion: 5, isReply: true, replyTo: "@merulox" }],
    tombstones: [],
    updatedAt: 1,
  };
  let collideOnce = true;
  const kv = {
    async get() { return structuredClone(state); },
    async put(_key, value) {
      state = JSON.parse(value);
      if (collideOnce) {
        collideOnce = false;
        state = { tweets: [{ text: "external", url: urls.external, threadResolved: true, threadVersion: 6 }], tombstones: [], updatedAt: 2, mutationId: "other" };
      }
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });
  try {
    const response = await onRequestPost(requestContext(kv, "POST", { tweets: [
      { text: "quote", url: urls.stale, threadResolved: true, threadVersion: 6 },
      { text: "photo", url: urls.media, threadResolved: true, threadVersion: 6, media: ["https://pbs.twimg.com/media/abc?format=jpg&name=medium", "https://evil.invalid/x"] },
      { text: "bad reply", url: urls.invalid, threadResolved: true, threadVersion: 6, isReply: true, replyTo: "@x" },
    ] }));
    assert.equal(response.status, 200);
    assert.equal(state.tweets.some((tweet) => tweet.url === urls.external), true);
    assert.equal(state.tweets.find((tweet) => tweet.url === urls.stale).isReply, undefined);
    assert.deepEqual(state.tweets.find((tweet) => tweet.url === urls.media).media, ["https://pbs.twimg.com/media/abc?format=jpg&name=medium"]);
    assert.equal(state.tweets.some((tweet) => tweet.url === urls.invalid), false);

    const deletion = await onRequestDelete(requestContext(kv, "DELETE", { url: urls.media, source: "test" }));
    assert.equal(deletion.status, 200);
    assert.equal(state.tweets.some((tweet) => tweet.url === urls.media), false);
    assert.equal(state.tombstones[0].url, urls.media);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("dev-authenticated requests can delete without exposing the ingest token", async () => {
  let state = { tweets: [{ text: "delete me", url: urls.media }], tombstones: [], updatedAt: 1 };
  const kv = {
    async get() { return structuredClone(state); },
    async put(_key, value) { state = JSON.parse(value); },
  };
  const response = await onRequestDelete({
    data: { devAuthenticated: true },
    env: { LIVE_TWEETS: kv, LOG_KV_TOKEN: "test-token" },
    request: new Request("https://dev.merulox.com/api/tweets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urls.media }),
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(state.tweets.length, 0);
});

test("dev-authenticated requests can toggle public tweet visibility", async () => {
  let state = { tweets: [], tombstones: [], visible: true, updatedAt: 1 };
  const kv = {
    async get() { return structuredClone(state); },
    async put(_key, value) { state = JSON.parse(value); },
  };
  const response = await onRequestPatch({
    data: { devAuthenticated: true },
    env: { LIVE_TWEETS: kv },
    request: new Request("https://dev.merulox.com/api/tweets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible: false }),
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(state.visible, false);
});
