const DEV_HOST = "dev.merulox.com";

// The static /cameras pilot is visible only on the authenticated development host.
export async function onRequest(context) {
	if (new URL(context.request.url).hostname !== DEV_HOST) {
		return new Response("Not Found", {
			status: 404,
			headers: { "Content-Type": "text/plain;charset=UTF-8", "Cache-Control": "no-store" },
		});
	}
	return context.next();
}
