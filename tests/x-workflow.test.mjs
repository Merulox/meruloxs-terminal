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

test("ingest canonicalizes stored /photo/1 URLs and repairs timestamps that disagree with the status id", async () => {
	const id = "2065085476126486737";
	let state = {
		tweets: [{ text: "old", url: `https://x.com/merulox/status/${id}/photo/1`, timestamp: "2020-01-01T00:00:00Z", date: "2020-01-01", threadResolved: true, threadVersion: 6 }],
		tombstones: [],
		updatedAt: 1,
	};
	const kv = { async get() { return structuredClone(state); }, async put(_k, v) { state = JSON.parse(v); } };
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response("", { status: 404 });
	try {
		const response = await onRequestPost(requestContext(kv, "POST", { tweets: [
			{ text: "new", url: "https://x.com/merulox/status/2113439957830500584", timestamp: "2026-10-23T01:18:46Z", threadResolved: true, threadVersion: 6 },
		] }));
		assert.equal(response.status, 200);
		const repaired = state.tweets.filter((tweet) => tweet.url.includes(id));
		assert.equal(repaired.length, 1);
		assert.equal(repaired[0].url, `https://x.com/merulox/status/${id}`);
		assert.equal(repaired[0].timestamp.slice(0, 7), "2026-06");
	} finally {
		globalThis.fetch = originalFetch;
	}
});

function tweetStore(tweets = []) {
  let state = { tweets, tombstones: [], updatedAt: 1 };
  const kv = {
    async get() { return structuredClone(state); },
    async put(_key, value) { state = JSON.parse(value); },
  };
  return {
    get tweets() { return state.tweets; },
    async ingest(tweet) {
      const tweets = Array.isArray(tweet) ? tweet : [tweet];
      const response = await onRequestPost(requestContext(kv, "POST", { tweets }));
      assert.equal(response.status, 200);
      return response.json();
    },
  };
}

const parentUrl = "https://x.com/parent/status/10";
const resolvedReply = {
  text: "reply",
  url: urls.stale,
  threadResolved: true,
  threadVersion: 6,
  isReply: true,
  replyTo: "@parent",
  replyToUrl: parentUrl,
  replyThread: [{ text: "parent context", url: parentUrl }],
};
const standalone = { text: "standalone", url: urls.stale, threadResolved: true, threadVersion: 6 };

test("manual corrected reply survives cached source-less v6 standalone pushes", async () => {
  const store = tweetStore();
  await store.ingest(standalone);
  await store.ingest({ ...resolvedReply, threadSource: "user-confirmed" });
  assert.equal(store.tweets[0].threadSource, "user-confirmed");
  await store.ingest({ ...standalone, text: "fresh content from cached thread classification" });
  assert.equal(store.tweets[0].isReply, true);
  assert.equal(store.tweets[0].replyToUrl, parentUrl);
  assert.equal(store.tweets[0].threadSource, "user-confirmed");
  assert.deepEqual(store.tweets[0].replyThread, resolvedReply.replyThread);
  assert.equal(store.tweets[0].text, "fresh content from cached thread classification");
});

test("complete legacy replies survive DOM standalone records at the same or newer version", async () => {
  for (const threadVersion of [5, 6]) {
    const store = tweetStore([{ ...resolvedReply, threadVersion }]);
    await store.ingest(standalone);
    assert.equal(store.tweets[0].isReply, true);
    assert.equal(store.tweets[0].replyToUrl, parentUrl);
    assert.equal(store.tweets[0].threadVersion, threadVersion);
    assert.deepEqual(store.tweets[0].replyThread, resolvedReply.replyThread);
  }
});

test("thread source enum survives normalization while unknown sources grant no authority", async () => {
  for (const threadSource of ["reply-context", "x-graphql", "user-confirmed"]) {
    const store = tweetStore();
    await store.ingest({ ...resolvedReply, threadSource, replyToUrl: "https://twitter.com/parent/status/10/photo/1?x=1" });
    assert.equal(store.tweets[0].threadSource, threadSource);
    assert.equal(store.tweets[0].replyToUrl, parentUrl);
  }
  for (const threadSource of ["dom", "toString", "__proto__"]) {
    const store = tweetStore([resolvedReply]);
    await store.ingest({ ...standalone, threadSource });
    assert.equal(store.tweets[0].threadSource, undefined);
    assert.equal(store.tweets[0].replyToUrl, parentUrl);
  }
});

test("equal or stronger explicit authoritative standalone corrections clear all reply fields", async () => {
  const sources = [undefined, "reply-context", "x-graphql", "user-confirmed"];
  for (let priorRank = 0; priorRank < sources.length; priorRank++) {
    for (let incomingRank = Math.max(1, priorRank); incomingRank < sources.length; incomingRank++) {
      const store = tweetStore([{ ...resolvedReply, threadSource: sources[priorRank] }]);
      await store.ingest({ ...standalone, threadSource: sources[incomingRank] });
      assert.equal(store.tweets[0].threadSource, sources[incomingRank]);
      assert.equal(store.tweets[0].threadResolved, true);
      for (const field of ["isReply", "replyTo", "replyToUrl", "replyThread"]) {
        assert.equal(store.tweets[0][field], undefined, field);
      }
    }
  }
});

test("weaker sources and older versions cannot overwrite stronger thread metadata", async () => {
  const sources = [undefined, "reply-context", "x-graphql", "user-confirmed"];
  for (let priorRank = 1; priorRank < sources.length; priorRank++) {
    for (let incomingRank = 0; incomingRank < priorRank; incomingRank++) {
      const prior = { ...resolvedReply, threadSource: sources[priorRank] };
      for (const correction of [standalone, { ...resolvedReply, replyToUrl: "https://x.com/other/status/11" }]) {
        const store = tweetStore([prior]);
        await store.ingest({ ...correction, threadVersion: 7, threadSource: sources[incomingRank] });
        assert.equal(store.tweets[0].threadSource, prior.threadSource);
        assert.equal(store.tweets[0].threadVersion, 6);
        assert.equal(store.tweets[0].replyToUrl, parentUrl);
        assert.deepEqual(store.tweets[0].replyThread, resolvedReply.replyThread);
      }
    }
  }
  for (const threadSource of sources) {
    const store = tweetStore([{ ...resolvedReply, threadSource }]);
    await store.ingest({ ...resolvedReply, threadSource, threadVersion: 5, replyToUrl: "https://x.com/other/status/11" });
    assert.equal(store.tweets[0].threadVersion, 6);
    assert.equal(store.tweets[0].replyToUrl, parentUrl);
  }
});

test("thread protection still refreshes text, media, timestamp, date and author on unresolved input", async () => {
  const prior = { ...resolvedReply, threadSource: "user-confirmed", author: "old", timestamp: "2026-11-01T00:00:00.000Z", date: "2026-11-01" };
  const store = tweetStore([prior]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });
  try {
    const fresh = {
      text: "new text",
      url: urls.stale,
      author: "new author",
      timestamp: "2026-11-02T00:00:00.000Z",
      date: "2026-11-02",
      media: ["https://pbs.twimg.com/media/new?format=jpg"],
    };
    const result = await store.ingest(fresh);
    assert.equal(result.pending, 0);
    for (const field of ["text", "author", "timestamp", "date", "media"]) {
      assert.deepEqual(store.tweets[0][field], fresh[field], field);
    }
    for (const field of ["threadResolved", "threadVersion", "threadSource", "isReply", "replyTo", "replyToUrl", "replyThread"]) {
      assert.deepEqual(store.tweets[0][field], prior[field], field);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("matching-parent context survives but changed-parent corrections discard stale context and handle", async () => {
  const store = tweetStore([{ ...resolvedReply, threadSource: "x-graphql" }]);
  const reply = { text: "refresh", url: urls.stale, threadResolved: true, threadVersion: 6, threadSource: "x-graphql", isReply: true };
  await store.ingest({ ...reply, replyToUrl: "https://twitter.com/parent/status/10/photo/1" });
  assert.deepEqual(store.tweets[0].replyThread, resolvedReply.replyThread);
  assert.equal(store.tweets[0].replyTo, "@parent");
  await store.ingest({ ...reply, replyToUrl: "https://x.com/other/status/11" });
  assert.equal(store.tweets[0].replyToUrl, "https://x.com/other/status/11");
  assert.equal(store.tweets[0].replyThread, undefined);
  assert.equal(store.tweets[0].replyTo, undefined);
  const context = [{ text: "new parent", url: "https://x.com/third/status/12" }];
  await store.ingest({ ...reply, replyToUrl: context[0].url, replyThread: context });
  assert.deepEqual(store.tweets[0].replyThread, context);
});

test("incomplete legacy false-positive reply remains clearable by a v6 standalone", async () => {
  const { replyToUrl, replyThread, ...incomplete } = resolvedReply;
  const store = tweetStore([{ ...incomplete, threadVersion: 5 }]);
  await store.ingest(standalone);
  assert.equal(store.tweets[0].threadVersion, 6);
  assert.equal(store.tweets[0].threadResolved, true);
  assert.equal(store.tweets[0].isReply, undefined);
  assert.equal(store.tweets[0].replyTo, undefined);
});

test("invalid parent URLs do not make unresolved replies publishable", async () => {
  const store = tweetStore();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 404 });
  try {
    const result = await store.ingest({ ...resolvedReply, replyToUrl: "https://evil.invalid/status/10" });
    assert.equal(result.pending, 1);
    assert.deepEqual(store.tweets, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a later weak duplicate in one batch cannot undo an authoritative standalone correction", async () => {
  const store = tweetStore([{ ...resolvedReply, threadSource: "user-confirmed" }]);
  await store.ingest([
    { ...standalone, threadSource: "user-confirmed" },
    { ...standalone, text: "latest text" },
  ]);
  assert.equal(store.tweets[0].isReply, undefined);
  assert.equal(store.tweets[0].replyToUrl, undefined);
  assert.equal(store.tweets[0].threadSource, "user-confirmed");
  assert.equal(store.tweets[0].text, "latest text");
});
