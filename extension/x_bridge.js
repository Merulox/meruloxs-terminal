// Isolated-world relay: page-world hook -> extension background.
window.addEventListener("message", (event) => {
	if (event.source !== window || event.data?.source !== "tweet-seeder") return;
	chrome.runtime.sendMessage({ action: "xGraphql", op: event.data.op, json: event.data.json }).catch(() => {});
});
