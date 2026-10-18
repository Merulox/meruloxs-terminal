const PUBLIC_HOST = "merulox.com";
const DEV_HOST = "dev.merulox.com";
const KEY_PREFIX = "project-description:";
const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_BODY_BYTES = 16_384;
const MAX_PROJECT_ID = 80;
const MAX_NAME = 120;
const MAX_DESCRIPTION = 2_000;
const MAX_INSTRUCTION = 1_000;
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(body, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			...extraHeaders,
		},
	});
}

function error(message, status) {
	return json({ error: message }, status);
}

function validProjectId(value) {
	return (
		typeof value === "string" &&
		value.length <= MAX_PROJECT_ID &&
		PROJECT_ID_PATTERN.test(value)
	);
}

function boundedString(value, field, maximum, { allowEmpty = false } = {}) {
	if (typeof value !== "string") throw new RequestError(`${field} must be a string`, 400);
	const normalized = value.trim();
	if (!allowEmpty && normalized.length === 0) {
		throw new RequestError(`${field} is required`, 400);
	}
	if (normalized.length > maximum) {
		throw new RequestError(`${field} must be at most ${maximum} characters`, 400);
	}
	return normalized;
}

class RequestError extends Error {
	constructor(message, status) {
		super(message);
		this.status = status;
	}
}

async function readJson(request) {
	const contentType = request.headers.get("Content-Type") ?? "";
	if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
		throw new RequestError("application/json content type required", 415);
	}

	const declaredLength = Number(request.headers.get("Content-Length"));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
		throw new RequestError("request body is too large", 413);
	}

	let text;
	try {
		text = await request.text();
	} catch {
		throw new RequestError("unable to read request body", 400);
	}
	if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
		throw new RequestError("request body is too large", 413);
	}

	let body;
	try {
		body = JSON.parse(text);
	} catch {
		throw new RequestError("invalid JSON", 400);
	}
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new RequestError("JSON object required", 400);
	}
	return body;
}

function requirePublicHost(request) {
	const hostname = new URL(request.url).hostname;
	if (hostname !== PUBLIC_HOST && hostname !== DEV_HOST) {
		throw new RequestError("not found", 404);
	}
	return hostname;
}

function requireMutationAccess(context) {
	const url = new URL(context.request.url);
	if (url.hostname !== DEV_HOST) {
		throw new RequestError("not found", 404);
	}
	if (context.data?.devAuthenticated !== true) {
		throw new RequestError("dev authentication required", 401);
	}
	const origin = context.request.headers.get("Origin");
	if (origin !== url.origin) {
		throw new RequestError("cross-origin request denied", 403);
	}
}

function requireKv(env) {
	if (!env?.PROJECT_DESCRIPTION_OVERRIDES) {
		throw new RequestError("project description storage is not configured", 503);
	}
	return env.PROJECT_DESCRIPTION_OVERRIDES;
}

async function listOverrides(kv) {
	const overrides = {};
	let cursor;
	do {
		const page = await kv.list({ prefix: KEY_PREFIX, cursor });
		for (const key of page.keys ?? []) {
			const id = key.name.slice(KEY_PREFIX.length);
			if (!validProjectId(id)) continue;
			const stored = await kv.get(key.name, "json");
			if (
				stored &&
				typeof stored.description === "string" &&
				stored.description.trim() &&
				stored.description.length <= MAX_DESCRIPTION
			) {
				overrides[id] = {
					description: stored.description,
					updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
				};
			}
		}
		cursor = page.list_complete === false ? page.cursor : undefined;
	} while (cursor);
	return overrides;
}

async function handleGet(context) {
	requirePublicHost(context.request);
	const kv = requireKv(context.env);
	return json({ overrides: await listOverrides(kv) });
}

async function handlePost(context) {
	requireMutationAccess(context);
	if (!context.env?.AI) throw new RequestError("AI binding is not configured", 503);
	const body = await readJson(context.request);
	if (!validProjectId(body.id)) throw new RequestError("invalid project id", 400);
	const name = boundedString(body.name, "name", MAX_NAME);
	const draft = boundedString(body.draft, "draft", MAX_DESCRIPTION);
	const sourceDescription = boundedString(
		body.sourceDescription,
		"sourceDescription",
		MAX_DESCRIPTION,
	);
	const description = boundedString(body.description, "description", MAX_DESCRIPTION);
	const role = boundedString(body.role, "role", MAX_DESCRIPTION);
	const impact = boundedString(body.impact, "impact", MAX_DESCRIPTION);
	const present = boundedString(body.present, "present", MAX_DESCRIPTION);
	const vision = boundedString(body.vision, "vision", MAX_DESCRIPTION);
	const frontier = boundedString(body.frontier, "frontier", MAX_DESCRIPTION);
	const instruction = boundedString(body.instruction ?? "", "instruction", MAX_INSTRUCTION, {
		allowEmpty: true,
	});

	let result;
	try {
		result = await context.env.AI.run(MODEL, {
			messages: [
				{
					role: "system",
					content:
						"Rewrite a Merulox portfolio project description in 2–3 plain-text sentences. Lead with concrete facts: what the project is and what it does. Then explain how it integrates into Merulox workflows or systems. Add one restrained, project-specific sentence with some soul only when the supplied facts earn it. Reject metaphor for its own sake, generic hype, and invented claims. Preserve concrete facts, present state, and blockers. An optional editing instruction may tune emphasis or voice but never override these factual constraints. Return only the description: no title, quotation marks, markdown, or commentary. Never exceed 2000 characters.",
				},
				{
					role: "user",
					content: [
						`Project: ${name}`,
						`Current unsaved draft: ${draft}`,
						`Published archive description: ${sourceDescription}`,
						`Canonical short description: ${description}`,
						`Role in the system: ${role}`,
						`Observed impact: ${impact}`,
						`Present state and blockers: ${present}`,
						`Vision: ${vision}`,
						`Frontier: ${frontier}`,
						`Optional editing instruction: ${instruction || "Use the default Merulox voice described above."}`,
					].join("\n\n"),
				},
			],
			max_tokens: 700,
		});
	} catch {
		throw new RequestError("AI preview generation failed", 502);
	}
	const preview = typeof result?.response === "string" ? result.response.trim() : "";
	if (!preview) throw new RequestError("AI returned an empty preview", 502);
	if (preview.length > MAX_DESCRIPTION) {
		throw new RequestError("AI preview exceeds the description limit", 502);
	}
	return json({ preview });
}

async function handlePut(context) {
	requireMutationAccess(context);
	const kv = requireKv(context.env);
	const body = await readJson(context.request);
	if (!validProjectId(body.id)) throw new RequestError("invalid project id", 400);
	const description = boundedString(body.description, "description", MAX_DESCRIPTION);
	const updatedAt = new Date().toISOString();
	await kv.put(
		`${KEY_PREFIX}${body.id}`,
		JSON.stringify({ description, updatedAt }),
	);
	return json({ id: body.id, description, updatedAt });
}

async function handleDelete(context) {
	requireMutationAccess(context);
	const kv = requireKv(context.env);
	const body = await readJson(context.request);
	if (!validProjectId(body.id)) throw new RequestError("invalid project id", 400);
	await kv.delete(`${KEY_PREFIX}${body.id}`);
	return json({ id: body.id, reset: true });
}

export async function onRequest(context) {
	try {
		switch (context.request.method) {
			case "GET":
				return await handleGet(context);
			case "POST":
				return await handlePost(context);
			case "PUT":
				return await handlePut(context);
			case "DELETE":
				return await handleDelete(context);
			default:
				return error("method not allowed", 405);
		}
	} catch (caught) {
		if (caught instanceof RequestError) return error(caught.message, caught.status);
		return error("project description request failed", 500);
	}
}
