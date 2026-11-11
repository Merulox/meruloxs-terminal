export const MUSIC_CONFIG_KEY = "music_config";
export const SECTION_KEYS = ["recent", "artists", "albums", "tracks"];
export const WHEN_DISABLED = ["hide-tab", "notice"];

// Public music visibility. Dev writes SITE_CONTROL["music_config"] as JSON:
//   { page: { enabled, whenDisabled: "hide-tab" | "notice" }, sections: { recent, artists, albums, tracks } }
// Missing, malformed, or unreadable state fails open: everything stays public.
export function defaultMusicConfig() {
	return {
		page: { enabled: true, whenDisabled: "hide-tab" },
		sections: { recent: true, artists: true, albums: true, tracks: true },
	};
}

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeMusicConfig(raw) {
	const config = defaultMusicConfig();
	if (!isPlainObject(raw)) return config;
	if (isPlainObject(raw.page)) {
		if (typeof raw.page.enabled === "boolean") config.page.enabled = raw.page.enabled;
		if (WHEN_DISABLED.includes(raw.page.whenDisabled)) config.page.whenDisabled = raw.page.whenDisabled;
	}
	if (isPlainObject(raw.sections)) {
		for (const key of SECTION_KEYS) {
			if (typeof raw.sections[key] === "boolean") config.sections[key] = raw.sections[key];
		}
	}
	return config;
}

// Validates a PATCH body. Returns { ok: true, patch } or { ok: false }.
// Only known fields with exact types are accepted, and at least one field is required.
export function parseMusicPatch(body) {
	if (!isPlainObject(body)) return { ok: false };
	const patch = {};
	for (const key of Object.keys(body)) {
		if (key !== "page" && key !== "sections") return { ok: false };
	}
	if ("page" in body) {
		const page = body.page;
		if (!isPlainObject(page)) return { ok: false };
		const out = {};
		for (const key of Object.keys(page)) {
			if (key === "enabled" && typeof page.enabled === "boolean") out.enabled = page.enabled;
			else if (key === "whenDisabled" && WHEN_DISABLED.includes(page.whenDisabled)) out.whenDisabled = page.whenDisabled;
			else return { ok: false };
		}
		if (!Object.keys(out).length) return { ok: false };
		patch.page = out;
	}
	if ("sections" in body) {
		const sections = body.sections;
		if (!isPlainObject(sections)) return { ok: false };
		const out = {};
		for (const key of Object.keys(sections)) {
			if (SECTION_KEYS.includes(key) && typeof sections[key] === "boolean") out[key] = sections[key];
			else return { ok: false };
		}
		if (!Object.keys(out).length) return { ok: false };
		patch.sections = out;
	}
	return Object.keys(patch).length ? { ok: true, patch } : { ok: false };
}

export function applyMusicPatch(config, patch) {
	const next = normalizeMusicConfig(config);
	if (patch.page) Object.assign(next.page, patch.page);
	if (patch.sections) Object.assign(next.sections, patch.sections);
	return next;
}

export async function readMusicConfig(env) {
	if (!env?.SITE_CONTROL) return defaultMusicConfig();
	try {
		const raw = await env.SITE_CONTROL.get(MUSIC_CONFIG_KEY);
		return raw === null ? defaultMusicConfig() : normalizeMusicConfig(JSON.parse(raw));
	} catch {
		return defaultMusicConfig();
	}
}

export function isDefaultConfig(config) {
	return config.page.enabled && SECTION_KEYS.every((key) => config.sections[key]);
}

export function isMusicPath(pathname) {
	const path = String(pathname).toLowerCase();
	return path === "/music" || path === "/music.html" || path.startsWith("/music/");
}

export function notFound(request) {
	return new Response(request.method === "HEAD" ? null : "Not Found", {
		status: 404,
		headers: { "Content-Type": "text/plain;charset=UTF-8", "Cache-Control": "no-store" },
	});
}

// What a public (non-dev) request should get for this path under this config.
//   "pass"       -> serve normally
//   "not-found"  -> 404 (page disabled, tab hidden)
//   "strip-nav"  -> non-music HTML with the music nav entries removed
//   "notice"     -> music page with its content replaced by a "currently disabled" notice
//   "sections"   -> music page with the disabled sections removed
export function publicMusicAction(config, pathname) {
	if (isMusicPath(pathname)) {
		if (!config.page.enabled) return config.page.whenDisabled === "notice" ? "notice" : "not-found";
		return SECTION_KEYS.some((key) => !config.sections[key]) ? "sections" : "pass";
	}
	return !config.page.enabled && config.page.whenDisabled === "hide-tab" ? "strip-nav" : "pass";
}

const NOTICE_HTML = '<h1>Music</h1><p class="muted">currently disabled</p>';

function rewriteMusicHtml(response, action, config) {
	if (typeof HTMLRewriter === "undefined") return response;
	const rewriter = new HTMLRewriter();
	const remove = { element: (element) => element.remove() };
	if (action === "strip-nav") {
		rewriter.on('a[href="/music"]', remove).on('a[href="/music/"]', remove);
	} else if (action === "notice") {
		rewriter.on("[data-music-root]", { element: (element) => element.setInnerContent(NOTICE_HTML, { html: true }) });
	} else if (action === "sections") {
		for (const key of SECTION_KEYS) {
			if (!config.sections[key]) rewriter.on(`[data-music-section="${key}"]`, remove);
		}
	}
	return rewriter.transform(response);
}

// Rewritten variants must never share validators or cache entries with the original asset,
// otherwise a browser that cached one variant would revalidate onto the other after a toggle.
export function uncacheVariant(response) {
	const variant = new Response(response.body, response);
	variant.headers.delete("ETag");
	variant.headers.delete("Last-Modified");
	variant.headers.delete("Content-Length");
	variant.headers.set("Cache-Control", "no-store");
	return variant;
}

// Applies the public music config to a request. `next(request)` fetches the asset.
// The KV read is skipped for requests that cannot be HTML navigations.
export async function applyPublicMusic(request, env, next) {
	const url = new URL(request.url);
	const wantsHtml = (request.headers.get("Accept") ?? "").includes("text/html");
	if (!wantsHtml && !isMusicPath(url.pathname)) return next(request);

	const config = await readMusicConfig(env);
	const action = publicMusicAction(config, url.pathname);
	if (action === "pass") return next(request);
	if (action === "not-found") return notFound(request);

	// Drop conditional headers so the origin cannot answer 304 for a variant we are about to rewrite.
	const headers = new Headers(request.headers);
	headers.delete("If-None-Match");
	headers.delete("If-Modified-Since");
	const response = await next(new Request(request, { headers }));
	if (response.status !== 200 || !response.headers.get("Content-Type")?.toLowerCase().startsWith("text/html")) return response;
	return uncacheVariant(rewriteMusicHtml(response, action, config));
}
