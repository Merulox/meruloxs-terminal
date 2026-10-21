const DEV_HOST = "dev.merulox.com";
const SITE_SWITCH_KEY = "site_enabled";

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>merulox</title>
<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#0b0b0c;color:#8a8a8f;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}</style></head>
<body><p>offline for now.</p></body>
</html>`;

// Public-site kill switch. Commander writes SITE_CONTROL["site_enabled"] = "0" | "1".
// Fails open: a missing binding, missing key, or KV error keeps the site public.
// dev.merulox.com stays reachable (behind its own auth) regardless of the switch.
export async function publicSiteEnabled(env) {
	if (!env?.SITE_CONTROL) return true;
	try {
		return (await env.SITE_CONTROL.get(SITE_SWITCH_KEY)) !== "0";
	} catch {
		return true;
	}
}

function offlineResponse(request) {
	return new Response(request.method === "HEAD" ? null : OFFLINE_HTML, {
		status: 503,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"Retry-After": "86400",
			"X-Robots-Tag": "noindex",
		},
	});
}

function safeEqual(left, right) {
	if (typeof left !== "string" || typeof right !== "string") return false;
	let difference = left.length ^ right.length;
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
	}
	return difference === 0;
}

export async function onRequest(context) {
	const { request, env } = context;
	if (new URL(request.url).hostname !== DEV_HOST) {
		if (!(await publicSiteEnabled(env))) return offlineResponse(request);
		return context.next();
	}
	if (request.method === "OPTIONS") {
		return context.next();
	}

	const authorization = request.headers.get("Authorization") ?? "";
	const bearerToken = authorization.replace(/^Bearer\s+/i, "").trim();
	if (bearerToken && safeEqual(bearerToken, env.LOG_KV_TOKEN)) {
		return context.next();
	}

	if (!env.DEV_AUTH_USER || !env.DEV_AUTH_PASSWORD) {
		return new Response("Dev authentication is not configured", {
			status: 503,
			headers: { "Cache-Control": "no-store" },
		});
	}

	const expected = `Basic ${btoa(`${env.DEV_AUTH_USER}:${env.DEV_AUTH_PASSWORD}`)}`;
	if (!safeEqual(authorization, expected)) {
		return new Response("Unauthorized", {
			status: 401,
			headers: {
				"Cache-Control": "no-store",
				"WWW-Authenticate": 'Basic realm="dev.merulox.com", charset="UTF-8"',
			},
		});
	}

	context.data.devAuthenticated = true;
	return context.next();
}
