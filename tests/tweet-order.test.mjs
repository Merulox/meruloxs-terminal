import assert from "node:assert/strict";
import test from "node:test";
import { orchestrateTweets, fullSizeMediaUrl } from "../src/lib/orchestrate-tweets.mjs";

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
