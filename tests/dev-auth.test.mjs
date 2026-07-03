import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";

function context(url, authorization, env = {}) {
	return {
		data: {},
		env: { DEV_AUTH_USER: "m", DEV_AUTH_PASSWORD: "secret", LOG_KV_TOKEN: "ingest", ...env },
		request: new Request(url, { headers: authorization ? { Authorization: authorization } : {} }),
		next: async () => new Response("ok"),
	};
}

test("dev host requires basic auth and marks authenticated requests", async () => {
	const blocked = await onRequest(context("https://dev.merulox.com/thinking"));
	assert.equal(blocked.status, 401);

	const allowedContext = context("https://dev.merulox.com/thinking", `Basic ${btoa("m:secret")}`);
	const allowed = await onRequest(allowedContext);
	assert.equal(allowed.status, 200);
	assert.equal(allowedContext.data.devAuthenticated, true);
});

test("production stays public and valid ingest bearer auth bypasses the dev prompt", async () => {
	assert.equal((await onRequest(context("https://merulox.com/thinking"))).status, 200);
	assert.equal((await onRequest(context("https://dev.merulox.com/api/tweets", "Bearer ingest"))).status, 200);
});
