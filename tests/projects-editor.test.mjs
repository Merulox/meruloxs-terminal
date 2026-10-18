import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { onRequest } from "../functions/api/project-descriptions.js";

const endpoint = "/api/project-descriptions";

class MemoryKv {
	constructor() {
		this.values = new Map();
		this.putCalls = [];
		this.deleteCalls = [];
	}

	async get(key, type) {
		const value = this.values.get(key) ?? null;
		return type === "json" && value !== null ? JSON.parse(value) : value;
	}

	async put(key, value) {
		this.putCalls.push({ key, value });
		this.values.set(key, value);
	}

	async delete(key) {
		this.deleteCalls.push(key);
		this.values.delete(key);
	}

	async list({ prefix = "" } = {}) {
		return {
			keys: [...this.values.keys()]
				.filter((name) => name.startsWith(prefix))
				.map((name) => ({ name })),
			list_complete: true,
		};
	}
}

class FakeAi {
	constructor(response = "A generated preview that has not been saved.") {
		this.response = response;
		this.calls = [];
	}

	async run(model, input) {
		this.calls.push({ model, input });
		return { response: this.response };
	}
}

function context({
	host = "dev.merulox.com",
	method = "GET",
	body,
	rawBody,
	origin,
	contentType = "application/json",
	authenticated = true,
	kv = new MemoryKv(),
	ai = new FakeAi(),
	env = {},
} = {}) {
	const headers = {};
	let requestBody;
	if (rawBody !== undefined) {
		requestBody = rawBody;
		if (contentType) headers["Content-Type"] = contentType;
	} else if (body !== undefined) {
		requestBody = JSON.stringify(body);
		if (contentType) headers["Content-Type"] = contentType;
	}
	if (origin) headers.Origin = origin;
	return {
		request: new Request(`https://${host}${endpoint}`, {
			method,
			headers,
			body: requestBody,
		}),
		data: authenticated ? { devAuthenticated: true } : {},
		env: {
			PROJECT_DESCRIPTION_OVERRIDES: kv,
			AI: ai,
			...env,
		},
	};
}

async function payload(response) {
	return response.json();
}

const validDescription = {
	id: "capital-map",
	description: "A manually revised description.",
};

const validPreviewRequest = {
	id: "capital-map",
	name: "Capital Map",
	draft: "Current local draft",
	sourceDescription: "Canonical archive copy",
	description: "Maps capital movement.",
	role: "Connects market evidence to research decisions.",
	impact: "Produced a verified flow dataset.",
	present: "Active; source coverage remains the blocker.",
	vision: "A durable map of investable movement.",
	frontier: "Reconcile additional market venues.",
	instruction: "Tighten the opening",
};

test("public and dev GET expose stored overrides without enabling caching", async () => {
	const kv = new MemoryKv();
	await kv.put(
		"project-description:capital-map",
		JSON.stringify({ description: "Persisted copy", updatedAt: "2026-10-18T00:00:00.000Z" }),
	);

	for (const host of ["merulox.com", "dev.merulox.com"]) {
		const response = await onRequest(context({ host, authenticated: false, kv }));
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		assert.deepEqual(await payload(response), {
			overrides: {
				"capital-map": {
					description: "Persisted copy",
					updatedAt: "2026-10-18T00:00:00.000Z",
				},
			},
		});
	}

	assert.equal(
		(await onRequest(context({ host: "example.com", authenticated: false, kv }))).status,
		404,
	);
});

test("every mutation rejects public host, unauthenticated dev, and cross-origin requests", async () => {
	const mutations = [
		{
			method: "POST",
			body: validPreviewRequest,
		},
		{ method: "PUT", body: validDescription },
		{ method: "DELETE", body: { id: "capital-map" } },
	];
	for (const mutation of mutations) {
		const attempts = [
			[context({ ...mutation, host: "merulox.com" }), 404],
			[context({ ...mutation, authenticated: false }), 401],
			[context({ ...mutation }), 403],
			[context({ ...mutation, origin: "https://merulox.com" }), 403],
		];
		for (const [attempt, expectedStatus] of attempts) {
			assert.equal((await onRequest(attempt)).status, expectedStatus);
		}
	}
});

test("manual PUT persists one project and returns saved metadata", async () => {
	const kv = new MemoryKv();
	const response = await onRequest(
		context({
			method: "PUT",
			body: validDescription,
			origin: "https://dev.merulox.com",
			kv,
		}),
	);
	assert.equal(response.status, 200);
	const saved = await payload(response);
	assert.equal(saved.id, validDescription.id);
	assert.equal(saved.description, validDescription.description);
	assert.match(saved.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
	assert.equal(kv.putCalls.length, 1);
	assert.equal(kv.putCalls[0].key, "project-description:capital-map");

	const publicResponse = await onRequest(
		context({ host: "merulox.com", authenticated: false, kv }),
	);
	assert.equal(
		(await payload(publicResponse)).overrides["capital-map"].description,
		validDescription.description,
	);
});

test("AI POST creates a preview with the required model and never persists it", async () => {
	const kv = new MemoryKv();
	const ai = new FakeAi("  Generated preview only.  ");
	const response = await onRequest(
		context({
			method: "POST",
			body: validPreviewRequest,
			origin: "https://dev.merulox.com",
			kv,
			ai,
		}),
	);
	assert.equal(response.status, 200);
	assert.deepEqual(await payload(response), { preview: "Generated preview only." });
	assert.equal(ai.calls.length, 1);
	assert.equal(ai.calls[0].model, "@cf/meta/llama-3.1-8b-instruct");
	assert.equal(kv.putCalls.length, 0);
	const systemPrompt = ai.calls[0].input.messages[0].content;
	const userPrompt = ai.calls[0].input.messages[1].content;
	assert.match(systemPrompt, /2–3 plain-text sentences/);
	assert.match(systemPrompt, /Reject metaphor for its own sake/);
	assert.match(systemPrompt, /Preserve concrete facts, present state, and blockers/);
	for (const value of [
		validPreviewRequest.description,
		validPreviewRequest.role,
		validPreviewRequest.impact,
		validPreviewRequest.present,
		validPreviewRequest.vision,
		validPreviewRequest.frontier,
	]) {
		assert.ok(userPrompt.includes(value));
	}
	assert.equal(kv.values.size, 0);
});

test("DELETE removes only the selected override so source content can resume", async () => {
	const kv = new MemoryKv();
	await kv.put("project-description:capital-map", JSON.stringify({ description: "Override" }));
	await kv.put("project-description:realm", JSON.stringify({ description: "Other override" }));
	kv.putCalls.length = 0;

	const response = await onRequest(
		context({
			method: "DELETE",
			body: { id: "capital-map" },
			origin: "https://dev.merulox.com",
			kv,
		}),
	);
	assert.equal(response.status, 200);
	assert.deepEqual(await payload(response), { id: "capital-map", reset: true });
	assert.deepEqual(kv.deleteCalls, ["project-description:capital-map"]);
	assert.equal(await kv.get("project-description:capital-map"), null);
	assert.notEqual(await kv.get("project-description:realm"), null);
});

test("invalid JSON, IDs, empty values, content types, and body limits are rejected", async () => {
	const cases = [
		[context({ method: "PUT", rawBody: "{bad", origin: "https://dev.merulox.com" }), 400],
		[
			context({
				method: "PUT",
				body: { id: "Capital Map", description: "copy" },
				origin: "https://dev.merulox.com",
			}),
			400,
		],
		[
			context({
				method: "PUT",
				body: { id: "capital-map", description: "   " },
				origin: "https://dev.merulox.com",
			}),
			400,
		],
		[
			context({
				method: "PUT",
				body: validDescription,
				contentType: "text/plain",
				origin: "https://dev.merulox.com",
			}),
			415,
		],
		[
			context({
				method: "PUT",
				rawBody: JSON.stringify({
					id: "capital-map",
					description: "x".repeat(17_000),
				}),
				origin: "https://dev.merulox.com",
			}),
			413,
		],
	];
	for (const [requestContext, expectedStatus] of cases) {
		assert.equal((await onRequest(requestContext)).status, expectedStatus);
	}
});

test("missing bindings and invalid AI output fail closed", async () => {
	const noKv = context({ host: "merulox.com", authenticated: false });
	delete noKv.env.PROJECT_DESCRIPTION_OVERRIDES;
	assert.equal((await onRequest(noKv)).status, 503);

	const previewBody = {
		...validPreviewRequest,
		id: "realm",
		name: "Realm",
	};
	const noAi = context({
		method: "POST",
		body: previewBody,
		origin: "https://dev.merulox.com",
	});
	delete noAi.env.AI;
	assert.equal((await onRequest(noAi)).status, 503);
	assert.equal(
		(
			await onRequest(
				context({
					method: "POST",
					body: previewBody,
					origin: "https://dev.merulox.com",
					ai: new FakeAi("   "),
				}),
			)
		).status,
		502,
	);
});

test("source keeps controls dev-only, applies GET overrides safely, and separates preview from save", async () => {
	const source = await readFile(
		new URL("../src/pages/projects/index.astro", import.meta.url),
		"utf8",
	);
	assert.match(source, /project\.archiveDescription/);
	assert.match(source, /data-project-id=\{id\}/);
	assert.match(source, /const projectNamesById = new Map/);
	assert.match(source, /Project ID collision/);
	for (const field of ["description", "role", "impact", "present", "vision", "frontier"]) {
		assert.match(source, new RegExp(`${field}: project\\.${field}`));
		assert.match(source, new RegExp(`${field}: record\\.${field}`));
	}
	assert.match(source, /id="project-description-context"/);
	assert.match(source, /window\.location\.hostname === "dev\.merulox\.com"/);
	assert.match(source, /document\.createElement\("button"\)/);
	assert.doesNotMatch(source, /<button[^>]+data-project-description-edit/i);
	assert.match(source, /apiRequest\("GET"\)/);
	assert.match(source, /output\.textContent = description/);
	assert.match(source, /apiRequest\("POST"/);
	assert.match(source, /AI preview ready — not saved\./);
	assert.match(source, /apiRequest\("PUT"/);
	assert.match(source, /apiRequest\("DELETE"/);
	assert.ok(source.indexOf('apiRequest("POST"') < source.indexOf('apiRequest("PUT"'));
	assert.doesNotMatch(source, /\.innerHTML\s*=/);

	const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
	assert.equal((wrangler.match(/binding = "PROJECT_DESCRIPTION_OVERRIDES"/g) ?? []).length, 2);
	assert.equal((wrangler.match(/id = "49d288683066494497167d236fdcccca"/g) ?? []).length, 2);
});
