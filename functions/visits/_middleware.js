// The /visits tab exists only on dev.merulox.com (behind the root dev auth).
import { DEV_HOST } from "../../src/lib/visits.js";

export async function onRequest(context) {
	if (new URL(context.request.url).hostname !== DEV_HOST) {
		return new Response("Not Found", {
			status: 404,
			headers: { "Content-Type": "text/plain;charset=UTF-8", "Cache-Control": "no-store" },
		});
	}
	return context.next();
}
