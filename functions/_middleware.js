const DEV_HOST = "dev.merulox.com";

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
	if (new URL(request.url).hostname !== DEV_HOST || request.method === "OPTIONS") {
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
