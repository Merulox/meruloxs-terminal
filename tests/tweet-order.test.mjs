import assert from "node:assert/strict";
import test from "node:test";
import { orchestrateTweets, fullSizeMediaUrl, assignPages } from "../src/lib/orchestrate-tweets.mjs";

const post = (id, iso, extra = {}) => ({ text: `t${id}`, url: `https://x.com/merulox/status/${id}`, timestamp: iso, ...extra });

test("a fresh reply does not pull an old root to the top; conversations run oldest to newest", () => {
	const oldRoot = post(1, "2026-06-01T00:00:00Z");
	const freshReply = post(2, "2026-11-02T00:00:00Z", { isReply: true, replyToUrl: oldRoot.url });
	const outside = { ...post(5, "2026-06-02T00:00:00Z", { isReply: true, replyToUrl: oldRoot.url }), author: "@someone" };
	const mid = post(3, "2026-10-01T00:00:00Z");
	const newest = post(4, "2026-10-30T00:00:00Z");
	const ids = orchestrateTweets([freshReply, mid, oldRoot, outside, newest]).map((t) => t.text);
	assert.deepEqual(ids, ["t4", "t3", "t1", "t5", "t2"]);
});

test("self-threads stay attached regardless of time gaps and cycles cannot loop", () => {
	const a = post(1, "2026-01-01T00:00:00Z", { isReply: true, replyToUrl: "https://x.com/merulox/status/2" });
	const b = post(2, "2026-01-02T00:00:00Z", { isReply: true, replyToUrl: "https://x.com/merulox/status/1" });
	const result = orchestrateTweets([a, b]);
	assert.equal(result.length, 2);
	const selfReply = post(9, "2026-12-01T00:00:00Z", { isReply: true, replyToUrl: "https://x.com/merulox/status/9" });
	assert.equal(orchestrateTweets([selfReply]).length, 1);
});

test("full-size media URL requests the large jpg variant", () => {
	assert.equal(fullSizeMediaUrl("https://pbs.twimg.com/media/abc?format=jpg&name=medium"), "https://pbs.twimg.com/media/abc?format=jpg&name=large");
});

test("display cap never separates a reply from its parent conversation", () => {
	const feed = [];
	for (let i = 0; i < 6; i += 1) feed.push(post(100 + i, `2026-10-${10 + i}T00:00:00Z`));
	// Old parent just outside the cap by time, but its reply is the newest item.
	const parent = post(1, "2026-09-01T00:00:00Z");
	const child = post(2, "2026-11-01T00:00:00Z", { isReply: true, replyToUrl: parent.url });
	const result = orchestrateTweets([...feed, parent, child], { limit: 3 });
	const urls = result.map((t) => t.url);
	assert.equal(urls.includes(child.url), urls.includes(parent.url));
	assert.ok(result.length >= 3);
});

test("pagination breaks only before conversation roots", () => {
	const mk = (i, extra = {}) => ({ text: `t${i}`, url: `https://x.com/merulox/status/${i}`, ...extra });
	const feed = [mk(1), mk(2), mk(3, { isReply: true, replyToUrl: mk(2).url }), mk(4, { isReply: true, replyToUrl: mk(3).url }), mk(5)];
	assert.deepEqual(assignPages(feed, 3), [0, 0, 0, 0, 1]);
	assert.deepEqual(assignPages(feed, 2), [0, 0, 0, 0, 1]);
});

test("saved outside-account intermediaries keep old conversations together across caps and pages", () => {
	const root = post(1, "2026-06-01T00:00:00Z");
	const intermediary = { ...post(2, "2026-06-02T00:00:00Z"), url: "https://x.com/other/status/2" };
	const child = post(3, "2026-07-01T00:00:00Z", {
		isReply: true, replyToUrl: intermediary.url, replyThread: [root, intermediary],
	});
	const unrelated = post(4, "2026-06-15T00:00:00Z");
	const input = [child, root, unrelated];
	const ordered = orchestrateTweets(input);
	assert.deepEqual(ordered.map(t => t.text), ["t4", "t1", "t3"]);
	assert.equal(ordered[2].replyToUrl, intermediary.url, "real direct parent is unchanged");
	assert.deepEqual(assignPages(ordered, 2), [0, 0, 0]);
	assert.equal(orchestrateTweets(input, { limit: 2 }).length, 3);
	assert.equal(orchestrateTweets(input, { limit: 1 }).length, 1);
});

test("stale ancestor context cannot attach a reply to an unrelated conversation", () => {
	const root = post(1, "2026-06-01T00:00:00Z");
	const child = post(3, "2026-07-01T00:00:00Z", {
		isReply: true, replyToUrl: "https://x.com/other/status/99",
		replyThread: [root, post(2, "2026-06-02T00:00:00Z")],
	});
	assert.deepEqual(orchestrateTweets([root, child]).map(t => t.text), ["t3", "t1"]);
});
