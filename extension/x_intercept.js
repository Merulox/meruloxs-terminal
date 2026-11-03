// Runs in X's own page world. Forwards X's timeline/conversation GraphQL responses to the extension
// (via x_bridge.js). Read-only: responses are cloned and the page behaves exactly as before.
(() => {
	if (window.__tweetSeederHook) return;
	window.__tweetSeederHook = true;
	const PATTERN = /\/i\/api\/graphql\/[A-Za-z0-9_-]+\/(UserTweetsAndReplies|UserTweets|TweetDetail)\b/;
	const emit = (op, json) => {
		try {
			window.postMessage({ source: "tweet-seeder", op, json }, window.location.origin);
		} catch {
			// Never let forwarding break the page.
		}
	};

	const originalFetch = window.fetch;
	window.fetch = function (...args) {
		const promise = originalFetch.apply(this, args);
		try {
			const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
			const match = url && url.match(PATTERN);
			if (match) {
				promise.then((response) => response.clone().json().then((json) => emit(match[1], json)).catch(() => {})).catch(() => {});
			}
		} catch {
			// ignore
		}
		return promise;
	};

	const originalOpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (method, url, ...rest) {
		try {
			const match = String(url).match(PATTERN);
			if (match) {
				this.addEventListener("load", () => {
					try {
						emit(match[1], JSON.parse(this.responseText));
					} catch {
						// ignore
					}
				});
			}
		} catch {
			// ignore
		}
		return originalOpen.call(this, method, url, ...rest);
	};
})();
