import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	acquireLock,
	atomicWriteJson,
	committedEvidence,
	defaultPaths,
	discoverLocalRepositories,
	extractArchiveContext,
	normalizeGitHubRemote,
	parseArgs,
	parseSources,
	remoteCommittedEvidence,
	runArchiveRefresh,
	selectItems,
} from "../scripts/archive-refresh.mjs";

const fixtureRemote = "https://github.com/example/archive-alpha";
const secondFixtureRemote = "https://github.com/example/archive-beta";

const projectRecord = {
	kind: "project",
	id: "sample-project",
	name: "Sample Project",
	sourceDescription: "A source-backed sample project.",
	description: "A bounded sample.",
	role: "Exercises deterministic tests.",
	impact: "Produces fixture evidence.",
	present: "Local only.",
	vision: "Remain deterministic.",
	frontier: "Add another fixture.",
};

const schemeRecord = {
	kind: "scheme",
	id: "sample-scheme",
	name: "Sample Scheme",
	sourceDescription: "A bounded sample scheme.",
	currentState: "No external outcome.",
	decision: "hold",
	bottleneck: "No receipt.",
	history: "2026-10 [research] fixture only",
};

function archiveHtml(records = [projectRecord, schemeRecord]) {
	return `<!doctype html><script type="application/json" id="archive-description-context">${JSON.stringify(records)}</script>`;
}

function response(body, status = 200, contentType = "application/json") {
	return new Response(contentType === "application/json" ? JSON.stringify(body) : body, {
		status,
		headers: { "Content-Type": contentType },
	});
}

function descriptionState({
	overrides = {},
	schemeOverrides = {},
	candidates = { project: {}, scheme: {} },
} = {}) {
	return { overrides, schemeOverrides, candidates };
}

function isDescriptionStateGet(url, init = {}) {
	return url.endsWith("/api/project-descriptions") && !init.method;
}

function archiveGet(url, init, records = [projectRecord]) {
	if (isDescriptionStateGet(url, init)) return response(descriptionState());
	return response(archiveHtml(records), 200, "text/html");
}

const oldRemoteHead = "a".repeat(40);

function indexedSha(index) {
	return `${index.toString(16).padStart(12, "0")}${"e".repeat(28)}`;
}
const currentRemoteHead = "b".repeat(40);

function githubCommit({
	sha = currentRemoteHead,
	message = "change fixture behavior",
	date = "2026-10-18T00:00:00Z",
	parents = [{ sha: oldRemoteHead }],
} = {}) {
	return {
		sha,
		parents,
		commit: {
			message,
			committer: { date },
		},
	};
}


async function fixtureFiles(t, sources = { "project:sample-project": [fixtureRemote] }) {
	const root = await mkdtemp(path.join(os.tmpdir(), "archive-refresh-test-"));
	t.after(async () => {
		await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true }));
	});
	const authFile = path.join(root, "auth.txt");
	const sourcesFile = path.join(root, "sources.json");
	const stateFile = path.join(root, "state", "state.json");
	await writeFile(authFile, "fixture-user:fixture-secret\n", { mode: 0o600 });
	await writeFile(sourcesFile, JSON.stringify({ version: 1, sources }), { mode: 0o600 });
	return { root, authFile, sourcesFile, stateFile };
}

function options(files, overrides = {}) {
	return {
		scope: "both",
		apply: false,
		force: false,
		maxItems: 45,
		baseUrl: "https://dev.example.test",
		...files,
		...overrides,
	};
}

test("argument parsing defaults to dry-run and honors StateDirectory and explicit paths", () => {
	const defaults = defaultPaths({ STATE_DIRECTORY: "/run/state/archive", XDG_CONFIG_HOME: "/cfg" }, "/home/test");
	assert.equal(defaults.stateFile, "/run/state/archive/state.json");
	assert.equal(defaults.sourcesFile, "/cfg/merulox/archive-refresh-sources.json");

	const parsed = parseArgs(
		[
			"--scope",
			"schemes",
			"--apply",
			"--force",
			"--max-items",
			"3",
			"--base-url",
			"https://dev.example.test/",
			"--state-file",
			"/tmp/custom-state.json",
			"--auth-file",
			"/tmp/custom-auth",
			"--sources-file",
			"/tmp/custom-sources.json",
		],
		{ env: {}, home: "/home/test" },
	);
	assert.deepEqual(parsed, {
		scope: "schemes",
		apply: true,
		force: true,
		maxItems: 3,
		baseUrl: "https://dev.example.test",
		stateFile: "/tmp/custom-state.json",
		authFile: "/tmp/custom-auth",
		sourcesFile: "/tmp/custom-sources.json",
	});
	assert.equal(parseArgs([], { env: {}, home: "/home/test" }).apply, false);
	assert.throws(() => parseArgs(["--scope", "all"]), /projects, schemes, or both/);
	assert.throws(() => parseArgs(["--max-items", "46"]), /1 to 45/);
	assert.throws(() => parseArgs(["--base-url", "https://user:secret@example.test"]), /credential-free/);
});

test("GitHub remotes normalize without accepting other hosts or malformed paths", () => {
	for (const remote of [
		"git@github.com:example/archive-alpha.git",
		"ssh://git@github.com/example/archive-alpha.git",
		"https://github.com/example/archive-alpha/",
		"git+https://github.com/example/archive-alpha.git",
	]) {
		assert.equal(normalizeGitHubRemote(remote), fixtureRemote);
	}
	assert.equal(normalizeGitHubRemote("https://gitlab.example/example/archive-alpha"), null);
	assert.equal(normalizeGitHubRemote("https://github.com/example/archive-alpha/extra"), null);
});

test("repository discovery checks a configured direct-home checkout without exposing its remote", async () => {
	const commandPaths = [];
	const discovered = await discoverLocalRepositories({
		home: "/home/fixture",
		repositories: [fixtureRemote],
		fsApi: {
			async readdir(directory) {
				assert.equal(directory, "/home/fixture/projects");
				return [];
			},
		},
		run: async (_command, args) => {
			commandPaths.push(args[1]);
			if (args[1] === "/home/fixture/archive-alpha") return `${fixtureRemote}\n`;
			throw new Error("fixture checkout has no origin");
		},
	});
	assert.deepEqual(commandPaths, ["/home/fixture/archive-alpha", "/home/fixture/website"]);
	assert.equal(discovered.get(fixtureRemote.toLowerCase()), "/home/fixture/archive-alpha");
});

test("HTML context extraction validates unique kind-qualified IDs and scope selection", () => {
	const records = extractArchiveContext(archiveHtml());
	assert.equal(records.length, 2);
	assert.deepEqual(selectItems(records, "projects").map((item) => item.id), ["sample-project"]);
	assert.deepEqual(selectItems(records, "schemes").map((item) => item.id), ["sample-scheme"]);
	assert.equal(selectItems(records, "both").length, 2);
	assert.throws(
		() => extractArchiveContext(archiveHtml([projectRecord, projectRecord])),
		/duplicate archive item/,
	);
	assert.throws(() => extractArchiveContext("<html></html>"), /context was not found/);
});

test("local sources parsing accepts only kind-qualified mapped fixture repositories", () => {
	const sources = parseSources({
		version: 1,
		sources: {
			"project:sample-project": [fixtureRemote, `${fixtureRemote}.git`],
			"scheme:sample-scheme": { repositories: [secondFixtureRemote] },
		},
	});
	assert.deepEqual(sources.get("project:sample-project"), [fixtureRemote]);
	assert.deepEqual(sources.get("scheme:sample-scheme"), [secondFixtureRemote]);
	assert.throws(() => parseSources({ "bad key": [fixtureRemote] }), /invalid source item key/);
});

test("atomic state writes replace the target and lock prevents concurrent runs", async (t) => {
	const root = await mkdtemp(path.join(os.tmpdir(), "archive-atomic-test-"));
	t.after(async () => {
		await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true }));
	});
	const stateFile = path.join(root, "nested", "state.json");
	await atomicWriteJson(stateFile, { version: 1, items: { a: 1 } });
	assert.deepEqual(JSON.parse(await readFile(stateFile, "utf8")), {
		version: 1,
		items: { a: 1 },
	});
	assert.deepEqual((await readdir(path.dirname(stateFile))).sort(), ["state.json"]);

	const release = await acquireLock(stateFile);
	await assert.rejects(() => acquireLock(stateFile), /already running/);
	await release();
	await writeFile(`${stateFile}.lock`, "");
	await assert.rejects(() => acquireLock(stateFile), /already running/);
	await import("node:fs/promises").then(({ rm }) => rm(`${stateFile}.lock`, { force: true }));
	const releaseAgain = await acquireLock(stateFile);
	await releaseAgain();
	await writeFile(`${stateFile}.lock`, "999999\n");
	const staleRelease = await acquireLock(stateFile, undefined, () => {
		const error = new Error("missing fixture process");
		error.code = "ESRCH";
		throw error;
	});
	await staleRelease();
	assert.deepEqual((await readdir(path.dirname(stateFile))).sort(), ["state.json"]);
});

test("committed evidence is bounded, source-numbered, and redacts mapped repository terms", async () => {
	const longSubject = `update archive-alpha ${"x".repeat(6_100)}`;
	const run = async (_command, args) => {
		assert.ok(args.includes("--max-count=30"));
		assert.equal(args.at(-1), "old-head..new-head");
		return `abcdef1234567890\t2026-10-18T00:00:00Z\t${longSubject}\n`;
	};
	const evidence = await committedEvidence("/fixture/repo", {
		previousHead: "old-head",
		currentHead: "new-head",
		repositories: [fixtureRemote],
		run,
	});
	assert.match(evidence.text, /^Source 1 commit abcdef123456/);
	assert.match(evidence.text, /\[source\]/);
	assert.doesNotMatch(evidence.text, /archive-alpha/i);
	assert.ok(evidence.text.length <= 6_000);
});

test("force evidence inspects the bounded recent committed window at the current head", async () => {
	let revision;
	await committedEvidence("/fixture/repo", {
		previousHead: "old-head",
		currentHead: "new-head",
		force: true,
		repositories: [fixtureRemote],
		run: async (_command, args) => {
			assert.ok(args.includes("--max-count=30"));
			revision = args.at(-1);
			return "abcdef1234567890\t2026-10-18T00:00:00Z\tfixture change\n";
		},
	});
	assert.equal(revision, "new-head");
});

test("forced remote evidence continues past 100 merges to the newest non-merge commits", async () => {
	const mergePage = Array.from({ length: 100 }, (_, index) =>
		githubCommit({
			sha: indexedSha(index),
			message: `merge fixture ${index}`,
			parents: [{ sha: oldRemoteHead }, { sha: "f".repeat(40) }],
		}),
	);
	const nonMergePage = Array.from({ length: 35 }, (_, index) =>
		githubCommit({
			sha: indexedSha(100 + index),
			message: `fixture change ${100 + index}`,
		}),
	);
	const endpoints = [];
	const evidence = await remoteCommittedEvidence(fixtureRemote, {
		currentHead: currentRemoteHead,
		force: true,
		repositories: [fixtureRemote],
		run: async (_command, args) => {
			endpoints.push(args[3]);
			return JSON.stringify(endpoints.length === 1 ? mergePage : nonMergePage);
		},
	});
	const commitsPrefix = `repos/example/archive-alpha/commits?sha=${currentRemoteHead}`;
	assert.deepEqual(endpoints, [
		`${commitsPrefix}&per_page=100&page=1`,
		`${commitsPrefix}&per_page=100&page=2`,
	]);
	assert.equal(evidence.commits.length, 30);
	assert.equal(
		evidence.commits[0],
		`Source 1 commit ${indexedSha(100).slice(0, 12)} 2026-10-18T00:00:00Z: fixture change 100`,
	);
	assert.equal(
		evidence.commits.at(-1),
		`Source 1 commit ${indexedSha(129).slice(0, 12)} 2026-10-18T00:00:00Z: fixture change 129`,
	);
	assert.doesNotMatch(evidence.text, /merge fixture|fixture change 130(?:\n|$)/);
});

test("forced remote evidence stops on a terminal short page with fewer than 30 non-merges", async () => {
	const mergePage = Array.from({ length: 100 }, (_, index) =>
		githubCommit({
			sha: indexedSha(index),
			message: `merge fixture ${index}`,
			parents: [{ sha: oldRemoteHead }, { sha: "f".repeat(40) }],
		}),
	);
	const finalPage = Array.from({ length: 4 }, (_, index) =>
		githubCommit({
			sha: indexedSha(100 + index),
			message: `terminal fixture change ${index}`,
		}),
	);
	const endpoints = [];
	const evidence = await remoteCommittedEvidence(fixtureRemote, {
		currentHead: currentRemoteHead,
		force: true,
		repositories: [fixtureRemote],
		run: async (_command, args) => {
			endpoints.push(args[3]);
			return JSON.stringify(endpoints.length === 1 ? mergePage : finalPage);
		},
	});
	assert.equal(endpoints.length, 2);
	assert.equal(evidence.commits.length, 4);
	assert.match(evidence.commits[0], /terminal fixture change 0$/);
	assert.match(evidence.commits.at(-1), /terminal fixture change 3$/);
});

test("forced remote evidence fails after ten unresolved full pages", async () => {
	const fullMergePage = Array.from({ length: 100 }, (_, index) =>
		githubCommit({
			sha: indexedSha(index),
			message: `merge fixture ${index}`,
			parents: [{ sha: oldRemoteHead }, { sha: "f".repeat(40) }],
		}),
	);
	const endpoints = [];
	await assert.rejects(
		() =>
			remoteCommittedEvidence(fixtureRemote, {
				currentHead: currentRemoteHead,
				force: true,
				repositories: [fixtureRemote],
				run: async (_command, args) => {
					endpoints.push(args[3]);
					return JSON.stringify(fullMergePage);
				},
			}),
		/bounded review window/,
	);
	assert.equal(endpoints.length, 10);
	assert.match(endpoints[0], /page=1$/);
	assert.match(endpoints.at(-1), /page=10$/);
});

test("ordinary remote compare selects the newest 30 commits from a single fetched page", async () => {
	const commits = Array.from({ length: 65 }, (_, index) =>
		githubCommit({
			sha: indexedSha(index),
			message: `fixture change ${index}`,
		}),
	);
	const endpoints = [];
	const evidence = await remoteCommittedEvidence(fixtureRemote, {
		previousHead: oldRemoteHead,
		currentHead: currentRemoteHead,
		repositories: [fixtureRemote],
		run: async (_command, args) => {
			endpoints.push(args[3]);
			return JSON.stringify({ total_commits: commits.length, commits });
		},
	});
	assert.deepEqual(endpoints, [
		`repos/example/archive-alpha/compare/${oldRemoteHead}...${currentRemoteHead}?per_page=100&page=1`,
	]);
	assert.equal(
		evidence.commits[0],
		`Source 1 commit ${indexedSha(64).slice(0, 12)} 2026-10-18T00:00:00Z: fixture change 64`,
	);
	assert.equal(
		evidence.commits.at(-1),
		`Source 1 commit ${indexedSha(35).slice(0, 12)} 2026-10-18T00:00:00Z: fixture change 35`,
	);
	assert.doesNotMatch(evidence.text, new RegExp(`${indexedSha(34).slice(0, 12)}|fixture change 34(?:\\n|$)`));
});

test("merge-heavy remote compare paginates backward without refetching page one", async () => {
	const makeRange = (start, end) =>
		Array.from({ length: end - start }, (_, offset) => {
			const index = start + offset;
			return githubCommit({
				sha: indexedSha(index),
				message: index >= 200 ? `merge fixture ${index}` : `fixture change ${index}`,
				parents:
					index >= 200
						? [{ sha: oldRemoteHead }, { sha: "f".repeat(40) }]
						: [{ sha: oldRemoteHead }],
			});
		});
	const pages = new Map([
		[1, makeRange(0, 100)],
		[2, makeRange(100, 200)],
		[3, makeRange(200, 235)],
	]);
	const endpoints = [];
	const evidence = await remoteCommittedEvidence(fixtureRemote, {
		previousHead: oldRemoteHead,
		currentHead: currentRemoteHead,
		repositories: [fixtureRemote],
		run: async (_command, args) => {
			const endpoint = args[3];
			endpoints.push(endpoint);
			const page = Number(new URLSearchParams(endpoint.split("?")[1]).get("page"));
			return JSON.stringify({ total_commits: 235, commits: pages.get(page) });
		},
	});
	const comparePrefix = `repos/example/archive-alpha/compare/${oldRemoteHead}...${currentRemoteHead}`;
	assert.deepEqual(endpoints, [
		`${comparePrefix}?per_page=100&page=1`,
		`${comparePrefix}?per_page=100&page=3`,
		`${comparePrefix}?per_page=100&page=2`,
	]);
	assert.equal(evidence.commits.length, 30);
	assert.equal(
		evidence.commits[0],
		`Source 1 commit ${indexedSha(199).slice(0, 12)} 2026-10-18T00:00:00Z: fixture change 199`,
	);
	assert.equal(
		evidence.commits.at(-1),
		`Source 1 commit ${indexedSha(170).slice(0, 12)} 2026-10-18T00:00:00Z: fixture change 170`,
	);
	assert.doesNotMatch(
		evidence.text,
		new RegExp(`merge fixture|${indexedSha(169).slice(0, 12)}|fixture change 169(?:\\n|$)`),
	);
});

test("remote source bootstrap reads the bounded default-branch head and performs no mutation", async (t) => {
	const files = await fixtureFiles(t);
	const fetchCalls = [];
	const commandCalls = [];
	const logs = [];
	const result = await runArchiveRefresh(options(files), {
		fetch: async (url, init = {}) => {
			if (isDescriptionStateGet(url, init)) {
				assert.match(init.headers.Authorization, /^Basic /);
				return response(descriptionState());
			}
			fetchCalls.push({ url, init });
			return response(archiveHtml([projectRecord]), 200, "text/html");
		},
		run: async (command, args) => {
			commandCalls.push({ command, args });
			assert.equal(command, "gh");
			assert.deepEqual(args.slice(0, 3), ["api", "--method", "GET"]);
			assert.equal(args[3], "repos/example/archive-alpha/commits?per_page=1");
			return JSON.stringify([{ sha: currentRemoteHead }]);
		},
		now: () => "2026-10-18T01:00:00.000Z",
		log: (line) => logs.push(line),
		repositoryIndex: new Map(),
	});
	assert.deepEqual(result, { exitCode: 0, failures: 0, processed: 1 });
	assert.equal(commandCalls.length, 1);
	assert.equal(fetchCalls.length, 1);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "bootstrapped");
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, currentRemoteHead);
	assert.deepEqual(logs, ["project:sample-project bootstrapped"]);
	assert.doesNotMatch(logs.join("\n"), /example|archive-alpha|fixture-secret/i);
});

test("remote changed range supplies redacted evidence and stages with PATCH", async (t) => {
	const files = await fixtureFiles(t);
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: oldRemoteHead, observedAt: "earlier" } },
				},
			},
		}),
	);
	const calls = [];
	const commandCalls = [];
	const logs = [];
	const result = await runArchiveRefresh(options(files, { apply: true }), {
		fetch: async (url, init = {}) => {
			if (isDescriptionStateGet(url, init)) return response(descriptionState());
			calls.push({ url, init });
			if (url.endsWith("/projects")) return response(archiveHtml([projectRecord]), 200, "text/html");
			if (init.method === "POST") return response({ preview: "Generated fixture prose" });
			assert.equal(init.method, "PATCH");
			return response({ staged: true });
		},
		run: async (command, args) => {
			commandCalls.push({ command, args });
			assert.equal(command, "gh");
			if (args[3].endsWith("commits?per_page=1")) {
				return JSON.stringify([{ sha: currentRemoteHead }]);
			}
			assert.equal(
				args[3],
				`repos/example/archive-alpha/compare/${oldRemoteHead}...${currentRemoteHead}?per_page=100&page=1`,
			);
			return JSON.stringify({
				total_commits: 2,
				commits: [
					githubCommit({
						sha: "c".repeat(40),
						message: "merge fixture branch",
						parents: [{ sha: oldRemoteHead }, { sha: "d".repeat(40) }],
					}),
					githubCommit({
						message: `update archive-alpha from ${fixtureRemote}\nbody is not evidence`,
					}),
				],
			});
		},
		now: () => "2026-10-18T02:00:00.000Z",
		log: (line) => logs.push(line),
		repositoryIndex: new Map(),
	});
	assert.deepEqual(result, { exitCode: 0, failures: 0, processed: 1 });
	assert.equal(commandCalls.length, 2);
	assert.deepEqual(calls.slice(1).map((call) => call.init.method), ["POST", "PATCH"]);
	const previewBody = JSON.parse(calls[1].init.body);
	assert.match(
		previewBody.evidence,
		new RegExp(`^Source 1 commit ${currentRemoteHead.slice(0, 12)} 2026-10-18T00:00:00Z:`),
	);
	assert.doesNotMatch(previewBody.evidence, /github\.com|example|archive-alpha|body is not evidence/i);
	const stagedBody = JSON.parse(calls[2].init.body);
	assert.equal(stagedBody.evidence, previewBody.evidence);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "staged");
	assert.equal(state.items["project:sample-project"].lastCommitCount, 1);
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, currentRemoteHead);
	assert.deepEqual(logs, ["project:sample-project staged"]);
	assert.doesNotMatch(
		logs.join("\n"),
		/example|archive-alpha|fixture-secret|Generated fixture prose|update archive-alpha/i,
	);
});

test("forced remote evidence requests and retains at most 30 recent commits", async (t) => {
	const files = await fixtureFiles(t);
	const calls = [];
	const commandCalls = [];
	const commits = Array.from({ length: 70 }, (_, index) =>
		githubCommit({
			sha: indexedSha(index),
			message: `${index % 4 === 0 ? "merge fixture" : "fixture change"} ${index} ${"x".repeat(50)}`,
			parents:
				index % 4 === 0
					? [{ sha: oldRemoteHead }, { sha: "f".repeat(40) }]
					: [{ sha: oldRemoteHead }],
		}),
	);
	const result = await runArchiveRefresh(options(files, { force: true }), {
		fetch: async (url, init = {}) => {
			if (isDescriptionStateGet(url, init)) return response(descriptionState());
			calls.push({ url, init });
			if (url.endsWith("/projects")) return response(archiveHtml([projectRecord]), 200, "text/html");
			return response({ preview: "Bounded fixture preview" });
		},
		run: async (command, args) => {
			commandCalls.push({ command, args });
			assert.equal(command, "gh");
			if (args[3].endsWith("commits?per_page=1")) {
				return JSON.stringify([{ sha: currentRemoteHead }]);
			}
			assert.equal(
				args[3],
				`repos/example/archive-alpha/commits?sha=${currentRemoteHead}&per_page=100&page=1`,
			);
			return JSON.stringify(commits);
		},
		now: () => "2026-10-18T03:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map(),
	});
	assert.equal(result.exitCode, 0);
	assert.equal(commandCalls.length, 2);
	const evidence = JSON.parse(calls[1].init.body).evidence;
	const lines = evidence.split("\n");
	assert.equal(lines.length, 30);
	assert.match(lines[0], new RegExp(`commit ${indexedSha(1).slice(0, 12)} .*fixture change 1 `));
	assert.match(lines.at(-1), new RegExp(`commit ${indexedSha(39).slice(0, 12)} .*fixture change 39 `));
	assert.ok(evidence.length <= 6_000);
	assert.doesNotMatch(
		evidence,
		new RegExp(`merge fixture|${indexedSha(41).slice(0, 12)}|fixture change 41 `),
	);
});

test("malformed remote compare payload fails generically without consuming the stored head", async (t) => {
	const files = await fixtureFiles(t);
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: oldRemoteHead, observedAt: "earlier" } },
				},
			},
		}),
	);
	const logs = [];
	const result = await runArchiveRefresh(options(files), {
		fetch: async (url, init = {}) => archiveGet(url, init),
		run: async (_command, args) =>
			args[3].endsWith("commits?per_page=1")
				? JSON.stringify([{ sha: currentRemoteHead }])
				: JSON.stringify({ commits: [] }),
		now: () => "2026-10-18T04:00:00.000Z",
		log: (line) => logs.push(line),
		repositoryIndex: new Map(),
	});
	assert.deepEqual(result, { exitCode: 1, failures: 1, processed: 1 });
	assert.deepEqual(logs, ["project:sample-project failed"]);
	assert.doesNotMatch(logs.join("\n"), /example|archive-alpha|fixture-secret|commits|compare/i);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "failed");
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, oldRemoteHead);
});

test("remote merge-only evidence advances the observed head without requesting a preview", async (t) => {
	const files = await fixtureFiles(t);
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: oldRemoteHead, observedAt: "earlier" } },
				},
			},
		}),
	);
	const fetchCalls = [];
	const result = await runArchiveRefresh(options(files), {
		fetch: async (url, init = {}) => {
			if (isDescriptionStateGet(url, init)) return response(descriptionState());
			fetchCalls.push(url);
			return response(archiveHtml([projectRecord]), 200, "text/html");
		},
		run: async (_command, args) => {
			if (args[3].endsWith("commits?per_page=1")) {
				return JSON.stringify([{ sha: currentRemoteHead }]);
			}
			return JSON.stringify({
				total_commits: 1,
				commits: [
					githubCommit({
						message: "merge archive-alpha fixture",
						parents: [{ sha: oldRemoteHead }, { sha: "d".repeat(40) }],
					}),
				],
			});
		},
		now: () => "2026-10-18T04:30:00.000Z",
		log: () => {},
		repositoryIndex: new Map(),
	});
	assert.deepEqual(result, { exitCode: 0, failures: 0, processed: 1 });
	assert.equal(fetchCalls.length, 1);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "no-commits");
	assert.equal(state.items["project:sample-project"].lastCommitCount, 0);
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, currentRemoteHead);
});

test("a matching local checkout remains preferred over the GitHub fallback", async (t) => {
	const files = await fixtureFiles(t);
	const commands = [];
	const result = await runArchiveRefresh(options(files), {
		fetch: async (url, init = {}) => archiveGet(url, init),
		run: async (command, args) => {
			commands.push({ command, args });
			assert.equal(command, "git");
			assert.deepEqual(args, ["-C", "/fixture/alpha", "rev-parse", "HEAD"]);
			return "local-head\n";
		},
		now: () => "2026-10-18T05:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([[fixtureRemote.toLowerCase(), "/fixture/alpha"]]),
	});
	assert.deepEqual(result, { exitCode: 0, failures: 0, processed: 1 });
	assert.equal(commands.length, 1);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, "local-head");
});

test("first ordinary run bootstraps repository heads and performs no API mutation", async (t) => {
	const files = await fixtureFiles(t);
	const calls = [];
	const fetch = async (url, init = {}) => {
		if (isDescriptionStateGet(url, init)) return response(descriptionState());
		calls.push({ url, init });
		return response(archiveHtml([projectRecord]), 200, "text/html");
	};
	const run = async (_command, args) => {
		assert.equal(args.at(-1), "HEAD");
		return "head-one\n";
	};
	const logs = [];
	const result = await runArchiveRefresh(options(files), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: (line) => logs.push(line),
		repositoryIndex: new Map([[fixtureRemote.toLowerCase(), "/fixture/alpha"]]),
	});
	assert.deepEqual(result, { exitCode: 0, failures: 0, processed: 1 });
	assert.equal(calls.length, 1);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "bootstrapped");
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, "head-one");
	assert.deepEqual(logs, ["project:sample-project bootstrapped"]);
});

test("changed-head dry-run requests an AI preview but never PATCHes, PUTs, or consumes the head", async (t) => {
	const files = await fixtureFiles(t);
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: "old-head", observedAt: "earlier" } },
				},
			},
		}),
	);
	const calls = [];
	const fetch = async (url, init = {}) => {
		if (isDescriptionStateGet(url, init)) return response(descriptionState());
		calls.push({ url, init });
		if (url.endsWith("/projects")) return response(archiveHtml([projectRecord]), 200, "text/html");
		assert.equal(init.method, "POST");
		return response({ kind: "project", id: "sample-project", preview: "Generated fixture prose" });
	};
	const run = async (_command, args) => {
		if (args.includes("rev-parse")) return "new-head\n";
		return "abcdef1234567890\t2026-10-18T00:00:00Z\tchange fixture behavior\n";
	};
	const logs = [];
	const result = await runArchiveRefresh(options(files), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: (line) => logs.push(line),
		repositoryIndex: new Map([[fixtureRemote.toLowerCase(), "/fixture/alpha"]]),
	});
	assert.equal(result.exitCode, 0);
	assert.deepEqual(calls.slice(1).map((call) => call.init.method), ["POST"]);
	const previewRequest = JSON.parse(calls[1].init.body);
	assert.match(previewRequest.evidence, /abcdef123456/);
	assert.doesNotMatch(previewRequest.evidence, /github\.com|archive-alpha/i);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "dry-run");
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, "old-head");
	assert.doesNotMatch(logs.join("\n"), /fixture-secret|Generated fixture prose|change fixture behavior/);
});

test("merge-only changed ranges advance observed heads without retrying forever", async (t) => {
	const files = await fixtureFiles(t);
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: "old-head", observedAt: "earlier" } },
				},
			},
		}),
	);
	const calls = [];
	const fetch = async (url, init = {}) => {
		if (isDescriptionStateGet(url, init)) return response(descriptionState());
		calls.push(url);
		return response(archiveHtml([projectRecord]), 200, "text/html");
	};
	const run = async (_command, args) =>
		args.includes("rev-parse") ? "merge-head\n" : "";
	const result = await runArchiveRefresh(options(files), {
		fetch,
		run,
		now: () => "2026-10-18T04:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([[fixtureRemote.toLowerCase(), "/fixture/alpha"]]),
	});
	assert.deepEqual(result, { exitCode: 0, failures: 0, processed: 1 });
	assert.equal(calls.length, 1);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "no-commits");
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, "merge-head");
	assert.equal(
		state.items["project:sample-project"].sources[fixtureRemote].observedAt,
		"2026-10-18T04:00:00.000Z",
	);
});

test("adding a source bootstraps only that source without consuming tracked-source changes", async (t) => {
	const files = await fixtureFiles(t, {
		"project:sample-project": [fixtureRemote, secondFixtureRemote],
	});
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: "old-head", observedAt: "earlier" } },
				},
			},
		}),
	);
	const methods = [];
	const fetch = async (url, init = {}) => {
		if (isDescriptionStateGet(url, init)) return response(descriptionState());
		if (url.endsWith("/projects")) return response(archiveHtml([projectRecord]), 200, "text/html");
		methods.push(init.method);
		return response({ preview: "Reviewable fixture draft" });
	};
	const run = async (_command, args) => {
		if (args.includes("rev-parse")) {
			return args[1] === "/fixture/alpha" ? "new-head\n" : "second-head\n";
		}
		assert.equal(args.at(-1), "old-head..new-head");
		return "abcdef1234567890\t2026-10-18T00:00:00Z\tchange fixture behavior\n";
	};
	const result = await runArchiveRefresh(options(files), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([
			[fixtureRemote.toLowerCase(), "/fixture/alpha"],
			[secondFixtureRemote.toLowerCase(), "/fixture/beta"],
		]),
	});
	assert.equal(result.exitCode, 0);
	assert.deepEqual(methods, ["POST"]);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, "old-head");
	assert.equal(state.items["project:sample-project"].sources[secondFixtureRemote].head, "second-head");
});

test("apply stages with PATCH rather than PUT and advances only the successful head", async (t) => {
	const files = await fixtureFiles(t);
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: "old-head", observedAt: "earlier" } },
					lastError: "stale fixture failure",
				},
			},
		}),
	);
	const calls = [];
	const fetch = async (url, init = {}) => {
		if (isDescriptionStateGet(url, init)) return response(descriptionState());
		calls.push({ url, init });
		if (url.endsWith("/projects")) return response(archiveHtml([projectRecord]), 200, "text/html");
		if (init.method === "POST") return response({ preview: "Reviewable fixture draft" });
		assert.equal(init.method, "PATCH");
		return response({ staged: true });
	};
	const run = async (_command, args) =>
		args.includes("rev-parse")
			? "new-head\n"
			: "abcdef1234567890\t2026-10-18T00:00:00Z\tchange fixture behavior\n";
	const result = await runArchiveRefresh(options(files, { apply: true }), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([[fixtureRemote.toLowerCase(), "/fixture/alpha"]]),
	});
	assert.equal(result.exitCode, 0);
	assert.deepEqual(calls.slice(1).map((call) => call.init.method), ["POST", "PATCH"]);
	assert.equal(calls.some((call) => call.init.method === "PUT"), false);
	const staged = JSON.parse(calls[2].init.body);
	assert.equal(staged.action, "stage");
	assert.equal(staged.kind, "project");
	assert.equal(staged.description, "Reviewable fixture draft");
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "staged");
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, "new-head");
	assert.equal(state.items["project:sample-project"].lastError, undefined);
});

test("an unresolved candidate blocks a later run before source observation and preserves the consumed head", async (t) => {
	const files = await fixtureFiles(t);
	await mkdir(path.dirname(files.stateFile), { recursive: true });
	await writeFile(
		files.stateFile,
		JSON.stringify({
			version: 1,
			items: {
				"project:sample-project": {
					sources: { [fixtureRemote]: { head: "old-head", observedAt: "earlier" } },
				},
			},
		}),
	);
	let pending = false;
	let runNumber = 1;
	const sourceCalls = [];
	const mutationCalls = [];
	const fetch = async (url, init = {}) => {
		if (isDescriptionStateGet(url, init)) {
			return response(
				descriptionState({
					candidates: {
						project: pending
							? {
									"sample-project": {
										description: "Awaiting review",
										version: "candidate-v1",
									},
								}
							: {},
						scheme: {},
					},
				}),
			);
		}
		if (url.endsWith("/projects")) return response(archiveHtml([projectRecord]), 200, "text/html");
		mutationCalls.push(init.method);
		if (init.method === "POST") return response({ preview: "Reviewable fixture draft" });
		pending = true;
		return response({ staged: true });
	};
	const run = async (_command, args) => {
		sourceCalls.push({ runNumber, args });
		if (args.includes("rev-parse")) return runNumber === 1 ? "consumed-head\n" : "later-head\n";
		return "abcdef1234567890\t2026-10-18T00:00:00Z\tchange fixture behavior\n";
	};
	const first = await runArchiveRefresh(options(files, { apply: true }), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([[fixtureRemote.toLowerCase(), "/fixture/alpha"]]),
	});
	assert.equal(first.exitCode, 0);
	assert.deepEqual(mutationCalls, ["POST", "PATCH"]);
	runNumber = 2;
	const callsBeforeSecondRun = sourceCalls.length;
	const mutationsBeforeSecondRun = mutationCalls.length;
	const second = await runArchiveRefresh(options(files, { apply: true }), {
		fetch,
		run,
		now: () => "2026-10-18T01:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([[fixtureRemote.toLowerCase(), "/fixture/alpha"]]),
	});
	assert.equal(second.exitCode, 0);
	assert.equal(sourceCalls.length, callsBeforeSecondRun);
	assert.equal(mutationCalls.length, mutationsBeforeSecondRun);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "candidate-pending");
	assert.equal(state.items["project:sample-project"].sources[fixtureRemote].head, "consumed-head");
});

test("published project and scheme overrides are the next draft bases", async (t) => {
	const files = await fixtureFiles(t, {
		"project:sample-project": [fixtureRemote],
		"scheme:sample-scheme": [secondFixtureRemote],
	});
	const drafts = new Map();
	const fetch = async (url, init = {}) => {
		if (isDescriptionStateGet(url, init)) {
			return response(
				descriptionState({
					overrides: {
						"sample-project": { description: "Current published project copy" },
					},
					schemeOverrides: {
						"sample-scheme": { description: "Current published scheme copy" },
					},
				}),
			);
		}
		if (url.endsWith("/projects")) return response(archiveHtml(), 200, "text/html");
		assert.equal(init.method, "POST");
		const body = JSON.parse(init.body);
		drafts.set(`${body.kind}:${body.id}`, body.draft);
		return response({ preview: "Generated fixture draft" });
	};
	const run = async (_command, args) =>
		args.includes("rev-parse")
			? "new-head\n"
			: "abcdef1234567890\t2026-10-18T00:00:00Z\tchange fixture behavior\n";
	const result = await runArchiveRefresh(options(files, { force: true }), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([
			[fixtureRemote.toLowerCase(), "/fixture/alpha"],
			[secondFixtureRemote.toLowerCase(), "/fixture/beta"],
		]),
	});
	assert.equal(result.exitCode, 0);
	assert.equal(drafts.get("project:sample-project"), "Current published project copy");
	assert.equal(drafts.get("scheme:sample-scheme"), "Current published scheme copy");
});

test("scope and max-items bound processing before repository work", async (t) => {
	const files = await fixtureFiles(t, {
		"project:sample-project": [fixtureRemote],
		"scheme:sample-scheme": [secondFixtureRemote],
	});
	const fetch = async (url, init = {}) => archiveGet(url, init, [projectRecord, schemeRecord]);
	let headCalls = 0;
	const run = async () => {
		headCalls += 1;
		return "head\n";
	};
	const result = await runArchiveRefresh(options(files, { scope: "schemes", maxItems: 1 }), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: () => {},
		repositoryIndex: new Map([
			[fixtureRemote.toLowerCase(), "/fixture/alpha"],
			[secondFixtureRemote.toLowerCase(), "/fixture/beta"],
		]),
	});
	assert.deepEqual(result, { exitCode: 0, failures: 0, processed: 1 });
	assert.equal(headCalls, 1);
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.deepEqual(Object.keys(state.items), ["scheme:sample-scheme"]);
});

test("one item failure returns nonzero while preserving another item's successful state", async (t) => {
	const files = await fixtureFiles(t, {
		"project:sample-project": [fixtureRemote],
		"scheme:sample-scheme": [secondFixtureRemote],
	});
	const fetch = async (url, init = {}) => archiveGet(url, init, [projectRecord, schemeRecord]);
	const run = async (_command, args) => {
		if (args[1] === "/fixture/beta") throw new Error("fixture head failure");
		return "head-one\n";
	};
	const logs = [];
	const result = await runArchiveRefresh(options(files), {
		fetch,
		run,
		now: () => "2026-10-18T00:00:00.000Z",
		log: (line) => logs.push(line),
		repositoryIndex: new Map([
			[fixtureRemote.toLowerCase(), "/fixture/alpha"],
			[secondFixtureRemote.toLowerCase(), "/fixture/beta"],
		]),
	});
	assert.deepEqual(result, { exitCode: 1, failures: 1, processed: 2 });
	const state = JSON.parse(await readFile(files.stateFile, "utf8"));
	assert.equal(state.items["project:sample-project"].lastStatus, "bootstrapped");
	assert.equal(state.items["scheme:sample-scheme"].lastStatus, "failed");
	assert.deepEqual(logs, ["project:sample-project bootstrapped", "scheme:sample-scheme failed"]);
});
