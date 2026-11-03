export function initMoodboardVisibility({ section, controls, button, status, isDev, signal, onShow, onHide, fetchImpl = fetch, pollMs = 30_000 }) {
	let enabled = null;
	let busy = false;
	let revision = 0;
	let showing = false;
	controls.hidden = !isDev;
	section.hidden = true;
	button.disabled = true;

	function show(visible) {
		section.hidden = !visible;
		if (showing === visible) return;
		showing = visible;
		if (visible) onShow();
		else onHide();
	}
	function render(error = "") {
		button.disabled = busy || enabled === null;
		button.textContent = enabled ? "Hide moodboard on public site" : "Show moodboard on public site";
		button.setAttribute("aria-pressed", String(enabled === true));
		status.textContent = error || (enabled === null ? "Checking public visibility…" : `Public moodboard: ${enabled ? "enabled" : "disabled"}. Preview stays visible here.`);
	}
	async function request(method, value) {
		const response = await fetchImpl("/api/moodboard", {
			method, cache: "no-store", credentials: "same-origin", signal,
			...(method === "PATCH" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: value }) } : {}),
		});
		if (!response.ok) throw new Error("Moodboard setting request failed");
		const data = await response.json();
		if (typeof data.enabled !== "boolean") throw new Error("Invalid moodboard setting");
		return data.enabled;
	}
	async function refresh() {
		if (signal.aborted || busy) return;
		const ticket = ++revision;
		try {
			const value = await request("GET");
			if (signal.aborted || ticket !== revision) return;
			enabled = value;
			show(isDev || enabled);
			render();
		} catch {
			if (signal.aborted || ticket !== revision) return;
			if (!isDev) show(false);
			render("Could not load public visibility. Retrying automatically.");
		}
	}
	async function toggle() {
		if (!isDev || signal.aborted || busy || enabled === null) return;
		busy = true;
		const ticket = ++revision;
		render();
		let error = "";
		try {
			const value = await request("PATCH", !enabled);
			if (signal.aborted || ticket !== revision) return;
			enabled = value;
		} catch {
			if (signal.aborted) return;
			error = "Could not save public visibility. Try again.";
		} finally {
			busy = false;
			if (!signal.aborted && ticket === revision) render(error);
		}
	}
	if (isDev) show(true);
	render();
	button.addEventListener("click", () => { void toggle(); }, { signal });
	const timer = pollMs > 0 ? setInterval(() => { void refresh(); }, pollMs) : null;
	signal.addEventListener("abort", () => {
		clearInterval(timer);
		if (showing) onHide();
	}, { once: true });
	void refresh();
	return { refresh, toggle };
}
