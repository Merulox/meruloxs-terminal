const SECTION_IDS = ["contact", "dev", "socials", "crypto", "media", "forums", "misc", "games"];
const ITEM_KINDS = new Set(["link", "text", "address"]);
const CUSTOM_ID = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_CONTROL_CHARACTERS = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validString(value, max = 500) {
	return typeof value === "string" && value.length > 0 && value.length <= max;
}
function validLabel(value) {
	return validString(value, 100) && value === value.trim() && !CONTROL_CHARACTERS.test(value);
}


function validHref(value) {
	if (!validString(value, 2048) || value !== value.trim() || CONTROL_CHARACTERS.test(value) ||
		/\s|\\/.test(value) || ENCODED_CONTROL_CHARACTERS.test(value)) return false;
	try {
		const url = new URL(value);
		if (url.protocol === "http:" || url.protocol === "https:") {
			return /^https?:\/\//i.test(value) && url.hostname.length > 0 && !url.username && !url.password;
		}
		if (url.protocol === "mailto:") {
			if (!/^mailto:/i.test(value) || value.slice(7).startsWith("//") || url.hash) return false;
			return /^[^@\s/?#]+@[^@\s/?#]+$/.test(value.slice(7).split("?", 1)[0]);
		}
		return false;
	} catch {
		return false;
	}
}

function normalizeItem(raw, sectionId) {
	if (!isObject(raw)) throw new Error("Invalid link item");
	if (!validString(raw.id, 100) || raw.section !== sectionId || !ITEM_KINDS.has(raw.kind)) {
		throw new Error("Invalid link item identity");
	}
	if (!validLabel(raw.label) || typeof raw.visible !== "boolean" ||
		!Number.isSafeInteger(raw.position) || typeof raw.custom !== "boolean") {
		throw new Error("Invalid link item fields");
	}
	if (raw.custom && !CUSTOM_ID.test(raw.id)) throw new Error("Invalid custom link identity");
	if (raw.kind === "link" && !validHref(raw.href)) throw new Error("Invalid link URL");
	if (raw.kind !== "link" && !validString(raw.value, 4096)) throw new Error("Invalid link value");
	if (raw.dead !== undefined && typeof raw.dead !== "boolean") throw new Error("Invalid dead flag");
	if (raw.pair !== undefined && raw.pair !== "fomo") throw new Error("Invalid pair");
	if (raw.style !== undefined && raw.style !== "contact" && raw.style !== "guestbook") throw new Error("Invalid style");

	const item = {
		id: raw.id,
		section: raw.section,
		kind: raw.kind,
		label: raw.label,
		visible: raw.visible,
		position: raw.position,
		custom: raw.custom,
	};
	if (raw.kind === "link") item.href = raw.href;
	else item.value = raw.value;
	if (raw.dead !== undefined) item.dead = raw.dead;
	if (raw.pair !== undefined) item.pair = raw.pair;
	if (raw.style !== undefined) item.style = raw.style;
	return item;
}

export function normalizeLinksPayload(raw) {
	if (!isObject(raw) || typeof raw.editable !== "boolean" || !Array.isArray(raw.sections) || raw.sections.length !== SECTION_IDS.length) {
		throw new Error("Invalid links response");
	}
	const seenSections = new Set();
	const seenItems = new Set();
	const byId = new Map();
	for (const section of raw.sections) {
		if (!isObject(section) || !SECTION_IDS.includes(section.id) || seenSections.has(section.id) ||
			!validString(section.label, 100) || !Array.isArray(section.items)) {
			throw new Error("Invalid links section");
		}
		seenSections.add(section.id);
		byId.set(section.id, section);
	}
	if (SECTION_IDS.some((id) => !seenSections.has(id))) throw new Error("Missing links section");

	const sections = SECTION_IDS.map((id) => {
		const rawSection = byId.get(id);
		const items = rawSection.items.map((rawItem) => {
			const item = normalizeItem(rawItem, id);
			if (seenItems.has(item.id)) throw new Error("Duplicate link item");
			seenItems.add(item.id);
			return item;
		}).filter((item) => raw.editable || item.visible);
		items.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
		return { id, label: rawSection.label, items };
	});
	return { editable: raw.editable, sections };
}

function snapshot(state) {
	return {
		phase: state.phase,
		editable: state.editable,
		sections: state.sections.map((section) => ({ ...section, items: section.items.map((item) => ({ ...item })) })),
		pendingMutation: state.pendingMutation,
		error: state.error,
		canRetry: Boolean(state.retryOperation),
	};
}

async function responseJson(response) {
	let data;
	try {
		data = await response.json();
	} catch {
		throw new Error("The links service returned an unreadable response");
	}
	if (!response.ok) {
		const message = isObject(data) && validString(data.error, 500) ? data.error : `Request failed (${response.status})`;
		throw new Error(message);
	}
	return data;
}

function normalizeMutationItem(raw, expectedId, expectedSection) {
	if (!isObject(raw) || !isObject(raw.item)) throw new Error("Invalid mutation response");
	const item = normalizeItem(raw.item, expectedSection ?? raw.item.section);
	if (item.id !== expectedId || (expectedSection && item.section !== expectedSection)) {
		throw new Error("Mutation response did not match the request");
	}
	return item;
}

export function createLinksController(options = {}) {
	const fetchImpl = options.fetch ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") throw new TypeError("fetch is required");
	const onState = typeof options.onState === "function" ? options.onState : () => {};
	const setIntervalImpl = options.setInterval ?? globalThis.setInterval;
	const clearIntervalImpl = options.clearInterval ?? globalThis.clearInterval;
	const pollMs = options.pollMs ?? 30_000;
	const requestAbort = new AbortController();
	let disposed = false;
	let editing = false;
	let loadSequence = 0;
	let mutationRevision = 0;
	const state = {
		phase: "idle",
		editable: false,
		sections: [],
		pendingMutation: false,
		error: "",
		retryOperation: null,
	};

	function emit() {
		if (!disposed) onState(snapshot(state));
	}

	function setError(error, retryOperation = null) {
		state.error = error instanceof Error ? error.message : String(error);
		state.retryOperation = retryOperation;
		state.phase = state.sections.length ? "ready" : "error";
		emit();
	}

	function replaceItem(item) {
		state.sections = state.sections.map((section) => {
			if (section.id !== item.section) return section;
			const index = section.items.findIndex((candidate) => candidate.id === item.id);
			const items = section.items.slice();
			if (index === -1) items.push(item);
			else items[index] = item;
			items.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
			return { ...section, items };
		});
	}

	async function load({ quiet = false } = {}) {
		if (disposed) return false;
		const sequence = ++loadSequence;
		const revision = mutationRevision;
		if (!quiet && !state.sections.length) {
			state.phase = "loading";
			state.error = "";
			state.retryOperation = null;
			emit();
		}
		try {
			const response = await fetchImpl("/api/links", {
				headers: { Accept: "application/json" },
				cache: "no-store",
				signal: requestAbort.signal,
			});
			const payload = normalizeLinksPayload(await responseJson(response));
			if (disposed || sequence !== loadSequence || revision !== mutationRevision) return false;
			state.phase = "ready";
			state.editable = payload.editable;
			state.sections = payload.sections;
			state.error = "";
			state.retryOperation = null;
			emit();
			return true;
		} catch (error) {
			if (disposed || error?.name === "AbortError" || sequence !== loadSequence) return false;
			if (!quiet || !state.sections.length) setError(error, () => load());
			return false;
		}
	}

	async function runMutation(operation, apply) {
		if (disposed || state.pendingMutation || !state.editable) return false;
		state.pendingMutation = true;
		state.error = "";
		state.retryOperation = null;
		emit();
		try {
			const result = await operation();
			if (disposed) return false;
			apply(result);
			mutationRevision += 1;
			state.pendingMutation = false;
			state.phase = "ready";
			state.error = "";
			state.retryOperation = null;
			emit();
			return true;
		} catch (error) {
			if (disposed || error?.name === "AbortError") return false;
			state.pendingMutation = false;
			setError(error, () => runMutation(operation, apply));
			return false;
		}
	}

	function toggle(id, visible) {
		if (typeof visible !== "boolean") return Promise.resolve(false);
		const existing = state.sections.flatMap((section) => section.items).find((item) => item.id === id);
		if (!existing) return Promise.resolve(false);
		const operation = async () => {
			const response = await fetchImpl("/api/links", {
				method: "PATCH",
				headers: { Accept: "application/json", "Content-Type": "application/json" },
				body: JSON.stringify({ id, visible }),
				signal: requestAbort.signal,
			});
			return normalizeMutationItem(await responseJson(response), id, existing.section);
		};
		return runMutation(operation, replaceItem);
	}

	function add(section, draft) {
		if (disposed || state.pendingMutation || !state.editable || !SECTION_IDS.includes(section) || !isObject(draft)) {
			return Promise.resolve(false);
		}
		const id = validString(draft.id, 100) ? draft.id : `custom-${(options.uuid ?? globalThis.crypto.randomUUID.bind(globalThis.crypto))()}`;
		const body = {
			id,
			section,
			label: typeof draft.label === "string" ? draft.label.trim() : "",
			href: typeof draft.href === "string" ? draft.href.trim() : "",
			visible: draft.visible !== false,
		};
		if (!CUSTOM_ID.test(id)) {
			setError(new Error("Couldn’t prepare a retry-safe link ID. Cancel this form and try again."));
			return Promise.resolve(false);
		}
		if (!body.label) {
			setError(new Error("Name is required."));
			return Promise.resolve(false);
		}
		if (!validLabel(body.label)) {
			setError(new Error("Name must be 1–100 characters without control characters."));
			return Promise.resolve(false);
		}
		if (!validHref(body.href)) {
			setError(new Error("Enter a valid HTTP(S) or mailto URL without credentials."));
			return Promise.resolve(false);
		}
		const operation = async () => {
			const response = await fetchImpl("/api/links", {
				method: "POST",
				headers: { Accept: "application/json", "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: requestAbort.signal,
			});
			return normalizeMutationItem(await responseJson(response), id, section);
		};
		return runMutation(operation, replaceItem);
	}

	function remove(id) {
		const existing = state.sections.flatMap((section) => section.items).find((item) => item.id === id);
		if (!existing?.custom) return Promise.resolve(false);
		const operation = async () => {
			const response = await fetchImpl("/api/links", {
				method: "DELETE",
				headers: { Accept: "application/json", "Content-Type": "application/json" },
				body: JSON.stringify({ id }),
				signal: requestAbort.signal,
			});
			const data = await responseJson(response);
			if (!isObject(data) || data.id !== id) throw new Error("Invalid delete response");
			return id;
		};
		return runMutation(operation, () => {
			state.sections = state.sections.map((section) => ({
				...section,
				items: section.items.filter((item) => item.id !== id),
			}));
		});
	}

	function retry() {
		if (state.pendingMutation || !state.retryOperation) return Promise.resolve(false);
		const operation = state.retryOperation;
		return operation();
	}

	function setEditing(value) {
		editing = Boolean(value);
	}

	function dispose() {
		if (disposed) return;
		disposed = true;
		requestAbort.abort();
		clearIntervalImpl(pollTimer);
		options.signal?.removeEventListener("abort", dispose);
	}

	const pollTimer = setIntervalImpl(() => {
		if (!disposed && state.phase === "ready" && !state.editable && !editing && !state.pendingMutation) {
			void load({ quiet: true });
		}
	}, pollMs);
	if (options.signal) {
		if (options.signal.aborted) dispose();
		else options.signal.addEventListener("abort", dispose, { once: true });
	}

	return { load, toggle, add, remove, retry, setEditing, dispose, getState: () => snapshot(state) };
}

export function createDraftStore() {
	const drafts = new Map();
	return {
		open(section) {
			if (!drafts.has(section)) drafts.set(section, { label: "", href: "", visible: true, id: null });
			return drafts.get(section);
		},
		get(section) {
			return drafts.get(section) ?? null;
		},
		update(section, field, value) {
			const draft = this.open(section);
			if (["label", "href", "visible", "id"].includes(field)) draft[field] = value;
			return draft;
		},
		close(section) {
			drafts.delete(section);
		},
		hasOpen() {
			return drafts.size > 0;
		},
		entries() {
			return drafts.entries();
		},
		snapshot() {
			return new Map(Array.from(drafts, ([key, value]) => [key, { ...value }]));
		},
	};
}

export function reconcileDraftWithItem(draft, item) {
	if (!isObject(draft) || !isObject(item) || !draft.id || draft.id !== item.id || item.kind !== "link") {
		return "unrelated";
	}
	const matches = (typeof draft.label === "string" ? draft.label.trim() : "") === item.label &&
		(typeof draft.href === "string" ? draft.href.trim() : "") === item.href &&
		(draft.visible !== false) === item.visible;
	if (matches) return "close";
	draft.id = null;
	return "retain";
}

export function focusDescriptorsMatch(saved, candidate) {
	if (!saved || !candidate) return false;
	const removalActions = new Set(["remove", "confirm-remove"]);
	const actionMatches = !saved.action || saved.action === candidate.action ||
		(removalActions.has(saved.action) && removalActions.has(candidate.action));
	return (!saved.linkId || saved.linkId === candidate.linkId) &&
		(!saved.sectionId || saved.sectionId === candidate.sectionId) &&
		actionMatches &&
		(!saved.name || saved.name === candidate.name);
}

export function createFocusMemory() {
	let intended = null;
	return {
		observe(captured, activeOutside = false) {
			if (captured && (captured.action !== "retry" || !intended)) intended = captured;
			else if (activeOutside) intended = null;
			return intended;
		},
		settle(restored, pending) {
			if (!restored && !pending) intended = null;
			return intended;
		},
		get() {
			return intended;
		},
	};
}

function element(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function hostFor(href) {
	try {
		const url = new URL(href);
		return url.protocol === "mailto:" ? url.pathname : url.hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

function captureFocus(root) {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
	return {
		linkId: active.closest("[data-link-id]")?.getAttribute("data-link-id") ?? "",
		sectionId: active.closest("[data-section-id]")?.getAttribute("data-section-id") ?? "",
		action: active.getAttribute("data-action") ?? "",
		name: active.getAttribute("name") ?? "",
		selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
		selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
	};
}

function restoreFocus(root, saved) {
	if (!saved) return false;
	const candidates = Array.from(root.querySelectorAll("a, button, input, textarea, select"));
	const target = candidates.find((node) => {
		if (!(node instanceof HTMLElement) || node.hasAttribute("disabled") || node.closest("[hidden]")) return false;
		return focusDescriptorsMatch(saved, {
			linkId: node.closest("[data-link-id]")?.getAttribute("data-link-id") ?? "",
			sectionId: node.closest("[data-section-id]")?.getAttribute("data-section-id") ?? "",
			action: node.getAttribute("data-action") ?? "",
			name: node.getAttribute("name") ?? "",
		});
	});
	if (!(target instanceof HTMLElement)) return false;
	target.focus({ preventScroll: true });
	if (saved.selectionStart !== null && typeof target.setSelectionRange === "function") {
		target.setSelectionRange(saved.selectionStart, saved.selectionEnd);
	}
	return document.activeElement === target;
}

function appendActions(row, item, state, confirming) {
	if (!state.editable) return;
	const actions = element("span", "link-actions");
	const toggle = element("button", "visibility-toggle", item.visible ? "public" : "hidden");
	toggle.type = "button";
	toggle.setAttribute("role", "switch");
	toggle.setAttribute("aria-checked", String(item.visible));
	toggle.setAttribute("aria-label", `${item.visible ? "Hide" : "Show"} ${item.label} on the public site`);
	toggle.dataset.action = "toggle";
	toggle.disabled = state.pendingMutation;
	actions.append(toggle);
	if (item.custom) {
		const remove = element("button", "remove-link", confirming.has(item.id) ? "Confirm remove" : "Remove");
		remove.type = "button";
		remove.dataset.action = confirming.has(item.id) ? "confirm-remove" : "remove";
		remove.disabled = state.pendingMutation;
		actions.append(remove);
	}
	row.append(actions);
}

function decorateRow(row, item, state) {
	row.dataset.linkId = item.id;
	if (state.editable && !item.visible) row.classList.add("is-hidden");
}

function renderLinkRow(item, state, confirming, extraClass = "") {
	const row = element("div", `link-entry${extraClass ? ` ${extraClass}` : ""}`);
	decorateRow(row, item, state);
	const anchor = element("a", item.dead ? "dead" : "");
	anchor.href = item.href;
	anchor.target = "_blank";
	anchor.rel = "noopener";
	anchor.append(element("span", "link-label", item.label), element("span", "link-host", hostFor(item.href)));
	row.append(anchor);
	appendActions(row, item, state, confirming);
	return row;
}

function renderAddControl(section, state, drafts) {
	const wrapper = element("div", "link-add");
	if (!state.editable) return wrapper;
	const draft = drafts.get(section.id);
	if (!draft) {
		const button = element("button", "new-link", "New link");
		button.type = "button";
		button.dataset.action = "new";
		button.disabled = state.pendingMutation;
		wrapper.append(button);
		return wrapper;
	}
	const form = element("form", "link-add-form");
	form.dataset.action = "add";
	const labelText = element("label", "");
	labelText.append(document.createTextNode("Name"));
	const labelInput = element("input", "");
	labelInput.name = "label";
	labelInput.required = true;
	labelInput.maxLength = 100;
	labelInput.value = draft.label;
	labelInput.disabled = state.pendingMutation;
	labelText.append(labelInput);
	const urlText = element("label", "");
	urlText.append(document.createTextNode("URL"));
	const urlInput = element("input", "");
	urlInput.name = "href";
	urlInput.type = "url";
	urlInput.required = true;
	urlInput.value = draft.href;
	urlInput.disabled = state.pendingMutation;
	urlText.append(urlInput);
	const visibleText = element("label", "show-public");
	const visibleInput = element("input", "");
	visibleInput.name = "visible";
	visibleInput.type = "checkbox";
	visibleInput.checked = draft.visible;
	visibleInput.disabled = state.pendingMutation;
	visibleText.append(visibleInput, document.createTextNode(" Show on public site"));
	const actions = element("div", "form-actions");
	const submit = element("button", "", state.pendingMutation ? "Saving…" : "Add link");
	submit.type = "submit";
	submit.dataset.action = "submit-new";
	submit.disabled = state.pendingMutation;
	const cancel = element("button", "", "Cancel");
	cancel.type = "button";
	cancel.dataset.action = "cancel-new";
	cancel.disabled = state.pendingMutation;
	actions.append(submit, cancel);
	form.append(labelText, urlText, visibleText, actions);
	wrapper.append(form);
	return wrapper;
}

function renderSection(section, state, drafts, confirming) {
	const sectionNode = element("section", "link-group");
	sectionNode.dataset.sectionId = section.id;
	sectionNode.append(element("h2", "eyebrow", section.label));
	const ordinary = section.items.filter((item) => item.kind === "link" && item.style !== "contact" && item.style !== "guestbook");
	const contacts = section.items.filter((item) => item.kind === "text" || item.style === "contact");
	const guestbooks = section.items.filter((item) => item.style === "guestbook");
	const addresses = section.items.filter((item) => item.kind === "address");

	if (contacts.length) {
		const block = element("div", "contact-block");
		for (const item of contacts) {
			const row = element("p", "contact-line");
			decorateRow(row, item, state);
			row.append(element("span", "contact-label", item.label));
			if (item.kind === "link") {
				const anchor = element("a", "", item.href.replace(/^mailto:/, ""));
				anchor.href = item.href;
				row.append(anchor);
			} else row.append(element("span", "", item.value));
			appendActions(row, item, state, confirming);
			block.append(row);
		}
		sectionNode.append(block);
	}
	for (const item of guestbooks) {
		const row = element("div", "link-entry");
		decorateRow(row, item, state);
		const anchor = element("a", "guestbook-button", item.label);
		anchor.href = item.href;
		anchor.target = "_blank";
		anchor.rel = "noopener";
		row.append(anchor);
		appendActions(row, item, state, confirming);
		sectionNode.append(row);
	}
	if (ordinary.length) {
		const nav = element("nav", "links-list");
		nav.setAttribute("aria-label", `${section.label} links`);
		const renderedPairs = new Set();
		for (const item of ordinary) {
			if (item.pair) {
				if (renderedPairs.has(item.pair)) continue;
				renderedPairs.add(item.pair);
				const pairedItems = ordinary.filter((candidate) => candidate.pair === item.pair);
				if (pairedItems.length === 1) {
					nav.append(renderLinkRow(pairedItems[0], state, confirming));
					continue;
				}
				const split = element("div", "split-link");
				split.setAttribute("role", "group");
				split.setAttribute("aria-label", `${item.pair} links`);
				for (const paired of pairedItems) split.append(renderLinkRow(paired, state, confirming));
				nav.append(split);
			} else nav.append(renderLinkRow(item, state, confirming));
		}
		sectionNode.append(nav);
	}
	if (addresses.length) {
		const block = element("div", "crypto-addresses contact-block");
		for (const item of addresses) {
			const row = element("div", "contact-line link-entry");
			decorateRow(row, item, state);
			row.append(element("span", "contact-label", item.label));
			const copy = element("button", "copy-address");
			copy.type = "button";
			copy.dataset.copyAddress = item.value;
			copy.dataset.action = "copy";
			copy.setAttribute("aria-label", `Copy ${item.label} address`);
			copy.append(element("span", "address-value", item.value), element("span", "copy-status", "copy"));
			row.append(copy);
			appendActions(row, item, state, confirming);
			block.append(row);
		}
		sectionNode.append(block);
	}
	sectionNode.append(renderAddControl(section, state, drafts));
	return sectionNode;
}

export function mountLinksEditor(root) {
	if (!(root instanceof HTMLElement)) throw new TypeError("links editor root is required");
	const status = root.querySelector("[data-links-status]");
	const retry = root.querySelector("[data-links-retry]");
	const sectionsRoot = root.querySelector("[data-links-sections]");
	if (!(status instanceof HTMLElement) || !(retry instanceof HTMLButtonElement) || !(sectionsRoot instanceof HTMLElement)) {
		throw new Error("Links editor mount points are missing");
	}
	const lifecycle = new AbortController();
	const copyTimers = new Set();
	const drafts = createDraftStore();
	const confirming = new Set();
	retry.dataset.action = "retry";
	const propagationNote = element(
		"p",
		"links-propagation-note",
		"Public visibility changes can take about a minute to propagate through Cloudflare.",
	);
	propagationNote.dataset.linksPropagation = "";
	propagationNote.hidden = true;
	root.insertBefore(propagationNote, sectionsRoot);
	let currentState = { phase: "idle", editable: false, sections: [], pendingMutation: false, error: "", canRetry: false };
	const focusMemory = createFocusMemory();

	function render(state = currentState) {
		currentState = state;
		const active = document.activeElement;
		const captured = captureFocus(root);
		const activeOutside = active instanceof HTMLElement && active !== document.body &&
			active !== document.documentElement && !root.contains(active);
		const intendedFocus = focusMemory.observe(captured, activeOutside);
		status.textContent = state.error || (state.phase === "loading" ? "Loading links…" : state.pendingMutation ? "Saving…" : "");
		retry.hidden = !state.canRetry;
		retry.disabled = state.pendingMutation;
		retry.textContent = state.sections.length ? "Retry save" : "Retry loading links";
		propagationNote.hidden = !state.editable;
		sectionsRoot.replaceChildren(...state.sections.map((section) => renderSection(section, state, drafts, confirming)));
		const restored = restoreFocus(root, intendedFocus);
		focusMemory.settle(restored, state.pendingMutation);
	}

	function focusSectionNewLink(section) {
		const active = document.activeElement;
		if (active instanceof HTMLElement && active !== document.body && active !== document.documentElement) return;
		const target = sectionsRoot.querySelector(`[data-section-id="${section}"] [data-action="new"]`);
		if (target instanceof HTMLElement) target.focus({ preventScroll: true });
	}

	const controller = createLinksController({
		signal: lifecycle.signal,
		onState: render,
	});
	root.addEventListener("focusin", () => {
		const captured = captureFocus(root);
		if (captured) focusMemory.observe(captured);
	}, { signal: lifecycle.signal });


	root.addEventListener("input", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) return;
		const section = target.closest("[data-section-id]")?.getAttribute("data-section-id");
		if (!section || !target.name) return;
		drafts.update(section, target.name, target.type === "checkbox" ? target.checked : target.value);
	}, { signal: lifecycle.signal });

	root.addEventListener("submit", async (event) => {
		const form = event.target;
		if (!(form instanceof HTMLFormElement) || form.dataset.action !== "add") return;
		event.preventDefault();
		const section = form.closest("[data-section-id]")?.getAttribute("data-section-id");
		const draft = section ? drafts.get(section) : null;
		if (!section || !draft || currentState.pendingMutation) return;
		if (!draft.id) draft.id = `custom-${crypto.randomUUID()}`;
		const submittedId = draft.id;
		const succeeded = await controller.add(section, draft);
		if (succeeded) {
			const item = currentState.sections.flatMap((entry) => entry.items).find((entry) => entry.id === submittedId);
			const reconciliation = reconcileDraftWithItem(draft, item);
			if (reconciliation === "close") drafts.close(section);
			controller.setEditing(drafts.hasOpen());
			render();
			if (reconciliation === "close") focusSectionNewLink(section);
		}
	}, { signal: lifecycle.signal });

	root.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const button = target.closest("button");
		if (!(button instanceof HTMLButtonElement)) return;
		const action = button.dataset.action;
		const section = button.closest("[data-section-id]")?.getAttribute("data-section-id");
		const id = button.closest("[data-link-id]")?.getAttribute("data-link-id");
		if (action === "new" && section) {
			drafts.open(section);
			controller.setEditing(true);
			render();
			sectionsRoot.querySelector(`[data-section-id="${section}"] input`)?.focus();
		} else if (action === "cancel-new" && section) {
			drafts.close(section);
			controller.setEditing(drafts.hasOpen());
			render();
		} else if (action === "toggle" && id) {
			const item = currentState.sections.flatMap((entry) => entry.items).find((entry) => entry.id === id);
			if (item) await controller.toggle(id, !item.visible);
		} else if (action === "remove" && id) {
			confirming.add(id);
			render();
		} else if (action === "confirm-remove" && id) {
			const succeeded = await controller.remove(id);
			if (succeeded) {
				confirming.delete(id);
				focusSectionNewLink(section);
			}
		} else if (button === retry) {
			const succeeded = await controller.retry();
			if (succeeded) {
				const items = new Map(currentState.sections.flatMap((entry) => entry.items).map((entry) => [entry.id, entry]));
				const closedSections = [];
				for (const [draftSection, draft] of drafts.entries()) {
					const item = draft.id ? items.get(draft.id) : null;
					if (reconcileDraftWithItem(draft, item) === "close") {
						drafts.close(draftSection);
						closedSections.push(draftSection);
					}
				}
				for (const confirmingId of confirming) {
					if (!items.has(confirmingId)) confirming.delete(confirmingId);
				}
				controller.setEditing(drafts.hasOpen());
				render();
				if (closedSections.length) focusSectionNewLink(closedSections[0]);
			}
		}
	}, { signal: lifecycle.signal });

	root.addEventListener("click", async (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const copy = target.closest(".copy-address");
		if (!(copy instanceof HTMLButtonElement)) return;
		const copyStatus = copy.querySelector(".copy-status");
		try {
			await navigator.clipboard.writeText(copy.dataset.copyAddress ?? "");
			if (lifecycle.signal.aborted) return;
			if (copyStatus) copyStatus.textContent = "copied";
			const timer = window.setTimeout(() => {
				copyTimers.delete(timer);
				if (copyStatus?.isConnected) copyStatus.textContent = "copy";
			}, 1600);
			copyTimers.add(timer);
		} catch {
			if (lifecycle.signal.aborted) return;
			if (copyStatus) copyStatus.textContent = "select";
		}
	}, { signal: lifecycle.signal });

	document.addEventListener("keydown", (event) => {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target;
		if (target instanceof Element && (target.closest("form") || target.matches("input, textarea, select, [contenteditable=true]"))) return;
		const items = Array.from(root.querySelectorAll("a[href], button:not([hidden]):not([disabled])"))
			.filter((item) => item instanceof HTMLElement && item.offsetParent !== null);
		if (!items.length) return;
		const current = items.indexOf(document.activeElement);
		if (event.key === "j" || event.key === "ArrowDown") {
			event.preventDefault();
			event.stopImmediatePropagation();
			const next = items[Math.min(current < 0 ? 0 : current + 1, items.length - 1)];
			next.focus({ preventScroll: true });
			next.scrollIntoView({ block: "nearest" });
		} else if (event.key === "k" || event.key === "ArrowUp") {
			event.preventDefault();
			event.stopImmediatePropagation();
			if (current <= 0) {
				const header = document.querySelector('[aria-current="page"], .site-name, .site-nav a');
				if (header instanceof HTMLElement) {
					window.scrollTo({ top: 0, behavior: "smooth" });
					header.focus({ preventScroll: true });
				}
			} else {
				items[current - 1].focus({ preventScroll: true });
				items[current - 1].scrollIntoView({ block: "nearest" });
			}
		} else if (event.key === "Enter" && current >= 0) {
			event.preventDefault();
			event.stopImmediatePropagation();
			items[current].click();
		}
	}, { capture: true, signal: lifecycle.signal });

	void controller.load();
	return () => {
		lifecycle.abort();
		for (const timer of copyTimers) window.clearTimeout(timer);
		copyTimers.clear();
		propagationNote.remove();
		controller.dispose();
	};
}
