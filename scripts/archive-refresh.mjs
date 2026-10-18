#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFile = promisify(execFileCallback);
const MAX_ITEMS = 45;
const MAX_EVIDENCE = 6_000;
const MAX_COMMITS_PER_SOURCE = 30;
const GITHUB_PAGE_SIZE = 100;
const MAX_GITHUB_COMPARE_REQUESTS = 10;
const DEFAULT_BASE_URL = "https://dev.merulox.com";

function configRoot(env, home) {
	return env.XDG_CONFIG_HOME || path.join(home, ".config");
}

function stateRoot(env, home) {
	return env.STATE_DIRECTORY ?? path.join(home, ".local", "state", "merulox-archive-refresh");
}

export function defaultPaths(env = process.env, home = os.homedir()) {
	return {
		stateFile: path.join(stateRoot(env, home), "state.json"),
		authFile: path.join(configRoot(env, home), "merulox", "archive-refresh-auth.txt"),
		sourcesFile: path.join(
			configRoot(env, home),
			"merulox",
			"archive-refresh-sources.json",
		),
	};
}

function optionValue(argv, index, name) {
	const value = argv[index + 1];
	if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
	return value;
}

export function parseArgs(
	argv = process.argv.slice(2),
	{ env = process.env, home = os.homedir() } = {},
) {
	const defaults = defaultPaths(env, home);
	const options = {
		scope: "both",
		apply: false,
		force: false,
		maxItems: MAX_ITEMS,
		baseUrl: DEFAULT_BASE_URL,
		stateFile: defaults.stateFile,
		authFile: defaults.authFile,
		sourcesFile: defaults.sourcesFile,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		switch (argument) {
			case "--scope":
				options.scope = optionValue(argv, index, argument);
				index += 1;
				break;
			case "--apply":
				options.apply = true;
				break;
			case "--force":
				options.force = true;
				break;
			case "--max-items": {
				const value = Number(optionValue(argv, index, argument));
				if (!Number.isSafeInteger(value) || value < 1 || value > MAX_ITEMS) {
					throw new Error(`--max-items must be an integer from 1 to ${MAX_ITEMS}`);
				}
				options.maxItems = value;
				index += 1;
				break;
			}
			case "--base-url":
				options.baseUrl = optionValue(argv, index, argument).replace(/\/+$/, "");
				index += 1;
				break;
			case "--state-file":
				options.stateFile = optionValue(argv, index, argument);
				index += 1;
				break;
			case "--auth-file":
				options.authFile = optionValue(argv, index, argument);
				index += 1;
				break;
			case "--sources-file":
				options.sourcesFile = optionValue(argv, index, argument);
				index += 1;
				break;
			default:
				throw new Error(`unknown argument: ${argument}`);
		}
	}
	if (!["projects", "schemes", "both"].includes(options.scope)) {
		throw new Error("--scope must be projects, schemes, or both");
	}
	let parsedBase;
	try {
		parsedBase = new URL(options.baseUrl);
	} catch {
		throw new Error("--base-url must be an absolute http(s) URL");
	}
	if (!["http:", "https:"].includes(parsedBase.protocol) || parsedBase.username || parsedBase.password) {
		throw new Error("--base-url must be an absolute credential-free http(s) URL");
	}
	options.baseUrl = parsedBase.toString().replace(/\/$/, "");
	return options;
}

export function normalizeGitHubRemote(remote) {
	if (typeof remote !== "string") return null;
	let value = remote.trim();
	if (!value) return null;
	const scp = value.match(/^(?:[^@\s]+@)?github\.com:([^\s]+)$/i);
	if (scp) value = `https://github.com/${scp[1]}`;
	value = value.replace(/^git\+/, "");
	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		return null;
	}
	if (parsed.hostname.toLowerCase() !== "github.com") return null;
	const parts = parsed.pathname
		.replace(/^\/+|\/+$/g, "")
		.replace(/\.git$/i, "")
		.split("/")
		.filter(Boolean);
	if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))) {
		return null;
	}
	return `https://github.com/${parts[0]}/${parts[1]}`;
}

export function extractArchiveContext(html) {
	if (typeof html !== "string") throw new Error("archive page must be text");
	const scripts = html.match(/<script\b[\s\S]*?<\/script>/gi) ?? [];
	const script = scripts.find((candidate) =>
		/\bid=(?:"archive-description-context"|'archive-description-context')/i.test(candidate),
	);
	if (!script) throw new Error("archive description context was not found");
	const match = script.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
	if (!match) throw new Error("archive description context is malformed");
	let parsed;
	try {
		parsed = JSON.parse(match[1].trim());
	} catch {
		throw new Error("archive description context is invalid JSON");
	}
	if (!Array.isArray(parsed)) throw new Error("archive description context must be an array");
	const keys = new Set();
	return parsed.map((item) => {
		if (
			!item ||
			!(["project", "scheme"].includes(item.kind)) ||
			typeof item.id !== "string" ||
			!item.id ||
			typeof item.name !== "string" ||
			typeof item.sourceDescription !== "string"
		) {
			throw new Error("archive description context contains an invalid item");
		}
		const key = `${item.kind}:${item.id}`;
		if (keys.has(key)) throw new Error(`duplicate archive item: ${key}`);
		keys.add(key);
		return { ...item };
	});
}

export function selectItems(items, scope = "both") {
	const kind = scope === "projects" ? "project" : scope === "schemes" ? "scheme" : null;
	return kind ? items.filter((item) => item.kind === kind) : [...items];
}

export function parseSources(value) {
	const sourceObject = value?.sources ?? value;
	if (!sourceObject || typeof sourceObject !== "object" || Array.isArray(sourceObject)) {
		throw new Error("sources file must contain an object or a sources object");
	}
	const result = new Map();
	for (const [key, configured] of Object.entries(sourceObject)) {
		if (!/^(project|scheme):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
			throw new Error(`invalid source item key: ${key}`);
		}
		const values = Array.isArray(configured) ? configured : configured?.repositories;
		if (!Array.isArray(values) || values.length === 0 || values.length > 4) {
			throw new Error(`sources for ${key} must contain one to four repositories`);
		}
		const repositories = values.map((remote) => {
			const normalized = normalizeGitHubRemote(remote);
			if (!normalized) throw new Error(`sources for ${key} contain an invalid GitHub remote`);
			return normalized;
		});
		result.set(key, [...new Set(repositories)]);
	}
	return result;
}

async function defaultRun(command, args) {
	const { stdout } = await execFile(command, args, {
		encoding: "utf8",
		maxBuffer: 1024 * 1024,
	});
	return stdout;
}

export async function discoverLocalRepositories({
	home = os.homedir(),
	run = defaultRun,
	fsApi = fs,
	repositories = [],
} = {}) {
	const roots = [];
	const projectsRoot = path.join(home, "projects");
	try {
		const children = await fsApi.readdir(projectsRoot, { withFileTypes: true });
		for (const child of children) {
			if (child.isDirectory()) roots.push(path.join(projectsRoot, child.name));
		}
	} catch (caught) {
		if (caught?.code !== "ENOENT") throw caught;
	}
	for (const repository of repositories) {
		const normalized = normalizeGitHubRemote(repository);
		if (!normalized) continue;
		const repositoryName = new URL(normalized).pathname.split("/").filter(Boolean).at(-1);
		if (repositoryName) roots.push(path.join(home, repositoryName));
	}
	roots.push(path.join(home, "website"));
	const discovered = new Map();
	for (const repositoryPath of new Set(roots)) {
		try {
			const remote = await run("git", ["-C", repositoryPath, "remote", "get-url", "origin"]);
			const normalized = normalizeGitHubRemote(remote);
			if (normalized) discovered.set(normalized.toLowerCase(), repositoryPath);
		} catch {
			// A candidate path without a usable Git remote is not a source checkout.
		}
	}
	return discovered;
}

export async function readState(stateFile, fsApi = fs) {
	try {
		const parsed = JSON.parse(await fsApi.readFile(stateFile, "utf8"));
		if (parsed && parsed.version === 1 && parsed.items && typeof parsed.items === "object") {
			return parsed;
		}
		throw new Error("state file has an unsupported schema");
	} catch (caught) {
		if (caught?.code === "ENOENT") return { version: 1, items: {} };
		throw caught;
	}
}

export async function atomicWriteJson(file, value, fsApi = fs) {
	await fsApi.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
	const temporary = path.join(
		path.dirname(file),
		`.${path.basename(file)}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`,
	);
	try {
		await fsApi.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
			mode: 0o600,
		});
		await fsApi.rename(temporary, file);
	} catch (caught) {
		await fsApi.rm(temporary, { force: true }).catch(() => {});
		throw caught;
	}
}

export async function acquireLock(stateFile, fsApi = fs, signal = process.kill) {
	const lockFile = `${stateFile}.lock`;
	await fsApi.mkdir(path.dirname(lockFile), { recursive: true, mode: 0o700 });
	const publish = async () => {
		const temporary = `${lockFile}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
		await fsApi.writeFile(temporary, `${process.pid}\n`, { flag: "wx", mode: 0o600 });
		try {
			await fsApi.link(temporary, lockFile);
		} finally {
			await fsApi.rm(temporary, { force: true }).catch(() => {});
		}
	};
	try {
		await publish();
	} catch (caught) {
		if (caught?.code !== "EEXIST") throw caught;
		const owner = Number((await fsApi.readFile(lockFile, "utf8").catch(() => "")).trim());
		if (!Number.isSafeInteger(owner) || owner <= 0) {
			throw new Error("archive refresh is already running");
		}
		try {
			signal(owner, 0);
			throw new Error("archive refresh is already running");
		} catch (probeError) {
			if (probeError?.code !== "ESRCH") throw probeError;
		}

		const observed = await fsApi.stat(lockFile);
		const claimFile = `${lockFile}.reclaim-${observed.dev}-${observed.ino}`;
		try {
			await fsApi.link(lockFile, claimFile);
		} catch {
			throw new Error("archive refresh is already running");
		}
		try {
			const [current, claimed] = await Promise.all([
				fsApi.stat(lockFile).catch(() => null),
				fsApi.stat(claimFile),
			]);
			if (!current || current.dev !== claimed.dev || current.ino !== claimed.ino) {
				throw new Error("archive refresh is already running");
			}
			await fsApi.rm(lockFile);
			try {
				await publish();
			} catch {
				throw new Error("archive refresh is already running");
			}
		} finally {
			await fsApi.rm(claimFile, { force: true }).catch(() => {});
		}
	}
	return async () => {
		await fsApi.rm(lockFile, { force: true });
	};
}

function authorizationHeader(contents) {
	const value = contents.trim();
	if (!value) throw new Error("authentication file is empty");
	return value.startsWith("Basic ") ? value : `Basic ${Buffer.from(value).toString("base64")}`;
}

function privateTerms(repository) {
	const parsed = new URL(repository);
	return parsed.pathname.split("/").filter(Boolean);
}

function redactPrivateTerms(text, repositories) {
	let result = text
		.replace(/(?:https?:\/\/|ssh:\/\/git@|git@)github\.com[/:][^\s]+/gi, "[source]")
		.replace(/[\u0000-\u001f\u007f]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	for (const term of repositories.flatMap(privateTerms).sort((a, b) => b.length - a.length)) {
		if (term.length < 3) continue;
		result = result.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[source]");
	}
	return result;
}

function githubRepositoryParts(repository) {
	const normalized = normalizeGitHubRemote(repository);
	if (!normalized || normalized !== repository) {
		throw new Error("configured source is not a normalized GitHub remote");
	}
	const [, owner, name] = new URL(normalized).pathname.split("/");
	return { owner, name };
}

function parseGitHubResponse(output, label) {
	if (typeof output !== "string" || !output.trim()) {
		throw new Error(`${label} was empty`);
	}
	try {
		return JSON.parse(output);
	} catch {
		throw new Error(`${label} was malformed`);
	}
}

async function runGitHubApi(run, endpoint) {
	try {
		return await run("gh", ["api", "--method", "GET", endpoint]);
	} catch {
		throw new Error("GitHub request failed");
	}
}


function githubCommitRecord(value) {
	if (
		!value ||
		typeof value !== "object" ||
		!Array.isArray(value.parents) ||
		!value.parents.every((parent) => /^[a-f0-9]{40}$/i.test(parent?.sha ?? "")) ||
		!value.commit ||
		typeof value.commit !== "object" ||
		typeof value.commit.message !== "string" ||
		typeof value.commit.committer?.date !== "string" ||
		!value.commit.committer.date ||
		!value.commit.message.trim() ||
		!/^[a-f0-9]{40}$/i.test(value.sha ?? "")
	) {
		throw new Error("GitHub commit response was malformed");
	}
	return {
		hash: value.sha,
		date: value.commit.committer.date,
		subject: value.commit.message.split(/\r?\n/, 1)[0],
		merge: value.parents.length > 1,
	};
}

function formatCommittedEvidence(records, { sourceNumber, repositories }) {
	const commits = records
		.filter((record) => !record.merge)
		.slice(0, MAX_COMMITS_PER_SOURCE)
		.map(({ hash, date, subject }) => {
			const redactedSubject = redactPrivateTerms(subject, repositories);
			return `Source ${sourceNumber} commit ${hash.slice(0, 12)} ${date}: ${redactedSubject}`;
		});
	return { commits, text: commits.join("\n").slice(0, MAX_EVIDENCE) };
}

export async function remoteRepositoryHead(repository, run = defaultRun) {
	const { owner, name } = githubRepositoryParts(repository);
	const output = await runGitHubApi(run, `repos/${owner}/${name}/commits?per_page=1`);
	const body = parseGitHubResponse(output, "GitHub head response");
	if (!Array.isArray(body) || body.length === 0 || !/^[a-f0-9]{40}$/i.test(body[0]?.sha ?? "")) {
		throw new Error("GitHub head response was malformed");
	}
	return body[0].sha;
}

function parseGitHubComparePage(output, expectedTotal) {
	const body = parseGitHubResponse(output, "GitHub commits response");
	if (
		!body ||
		typeof body !== "object" ||
		!Number.isSafeInteger(body.total_commits) ||
		body.total_commits < 1 ||
		(expectedTotal !== undefined && body.total_commits !== expectedTotal) ||
		!Array.isArray(body.commits) ||
		body.commits.length === 0 ||
		body.commits.length > GITHUB_PAGE_SIZE ||
		body.commits.length > body.total_commits
	) {
		throw new Error("GitHub commits response was malformed");
	}
	return body;
}

export async function remoteCommittedEvidence(
	repository,
	{ previousHead, currentHead, force = false, sourceNumber = 1, repositories = [], run = defaultRun } = {},
) {
	if (
		!/^[a-f0-9]{40}$/i.test(currentHead ?? "") ||
		(!force && !/^[a-f0-9]{40}$/i.test(previousHead ?? ""))
	) {
		throw new Error("stored GitHub head was malformed");
	}
	const { owner, name } = githubRepositoryParts(repository);
	if (force) {
		const commitsEndpoint = `repos/${owner}/${name}/commits?sha=${currentHead}`;
		const records = [];
		let nonMergeCount = 0;
		for (let pageNumber = 1; pageNumber <= MAX_GITHUB_COMPARE_REQUESTS; pageNumber += 1) {
			const body = parseGitHubResponse(
				await runGitHubApi(
					run,
					`${commitsEndpoint}&per_page=${GITHUB_PAGE_SIZE}&page=${pageNumber}`,
				),
				"GitHub commits response",
			);
			if (!Array.isArray(body) || body.length > GITHUB_PAGE_SIZE) {
				throw new Error("GitHub commits response was malformed");
			}
			const pageRecords = body.map(githubCommitRecord);
			records.push(...pageRecords);
			nonMergeCount += pageRecords.filter((record) => !record.merge).length;
			if (nonMergeCount >= MAX_COMMITS_PER_SOURCE || body.length < GITHUB_PAGE_SIZE) {
				return formatCommittedEvidence(records, { sourceNumber, repositories });
			}
		}
		throw new Error("GitHub commits response exceeded the bounded review window");
	}

	const compareEndpoint = `repos/${owner}/${name}/compare/${previousHead}...${currentHead}`;
	const firstPage = parseGitHubComparePage(
		await runGitHubApi(run, `${compareEndpoint}?per_page=${GITHUB_PAGE_SIZE}&page=1`),
	);
	const totalPages = Math.ceil(firstPage.total_commits / GITHUB_PAGE_SIZE);
	let pageNumber = totalPages;
	let requests = 1;
	const records = [];
	let nonMergeCount = 0;
	while (pageNumber >= 1 && nonMergeCount < MAX_COMMITS_PER_SOURCE) {
		let page = firstPage;
		if (pageNumber !== 1) {
			if (requests >= MAX_GITHUB_COMPARE_REQUESTS) {
				throw new Error("GitHub commits response exceeded the bounded review window");
			}
			page = parseGitHubComparePage(
				await runGitHubApi(
					run,
					`${compareEndpoint}?per_page=${GITHUB_PAGE_SIZE}&page=${pageNumber}`,
				),
				firstPage.total_commits,
			);
			requests += 1;
		}
		const pageRecords = page.commits.map(githubCommitRecord).reverse();
		records.push(...pageRecords);
		nonMergeCount += pageRecords.filter((record) => !record.merge).length;
		pageNumber -= 1;
	}
	return formatCommittedEvidence(records, { sourceNumber, repositories });
}

export async function repositoryHead(repositoryPath, run = defaultRun) {
	return (await run("git", ["-C", repositoryPath, "rev-parse", "HEAD"])).trim();
}

export async function committedEvidence(
	repositoryPath,
	{ previousHead, currentHead, force = false, sourceNumber = 1, repositories = [], run = defaultRun } = {},
) {
	const revision = force ? currentHead : `${previousHead}..${currentHead}`;
	const args = [
		"-C",
		repositoryPath,
		"log",
		"--no-merges",
		`--max-count=${MAX_COMMITS_PER_SOURCE}`,
		"--format=%H%x09%cI%x09%s",
	];
	args.push(revision);
	const output = await run("git", args);
	const records = output
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [hash = "", date = "", ...subjectParts] = line.split("\t");
			return {
				hash,
				date,
				subject: subjectParts.join(" "),
				merge: false,
			};
		});
	return formatCommittedEvidence(records, { sourceNumber, repositories });
}

function newItemState(previous, now) {
	return {
		...(previous ?? {}),
		lastCheckedAt: now,
		sources: { ...(previous?.sources ?? {}) },
	};
}

async function responseJson(response, label) {
	let body;
	try {
		body = await response.json();
	} catch {
		throw new Error(`${label} returned invalid JSON (${response.status})`);
	}
	if (!response.ok) {
		throw new Error(`${label} failed (${response.status}): ${body?.error ?? "unknown error"}`);
	}
	return body;
}

function objectMap(value, field) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`description state returned malformed ${field}`);
	}
	return value;
}

function descriptionState(body) {
	const root = objectMap(body, "payload");
	const overrides = objectMap(root.overrides, "overrides");
	const schemeOverrides = objectMap(root.schemeOverrides, "schemeOverrides");
	const candidates = objectMap(root.candidates, "candidates");
	return {
		overrides,
		schemeOverrides,
		candidates: {
			project: objectMap(candidates.project, "project candidates"),
			scheme: objectMap(candidates.scheme, "scheme candidates"),
		},
	};
}

function validDescription(value) {
	return Boolean(
		value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			typeof value.description === "string" &&
			value.description.trim() &&
			value.description.length <= 2_000,
	);
}

function draftBase(record, descriptions) {
	const collection =
		record.kind === "project" ? descriptions.overrides : descriptions.schemeOverrides;
	const override = collection[record.id];
	return validDescription(override) ? override.description : record.sourceDescription;
}

export async function runArchiveRefresh(options, dependencies = {}) {
	const fsApi = dependencies.fs ?? fs;
	const fetchApi = dependencies.fetch ?? globalThis.fetch;
	const run = dependencies.run ?? defaultRun;
	const home = dependencies.home ?? os.homedir();
	const now = dependencies.now ?? (() => new Date().toISOString());
	const log = dependencies.log ?? ((message) => console.log(message));
	const requestOrigin = new URL(options.baseUrl).origin;
	const release = await acquireLock(options.stateFile, fsApi);
	let failures = 0;
	try {
		const [authContents, sourcesContents] = await Promise.all([
			fsApi.readFile(options.authFile, "utf8"),
			fsApi.readFile(options.sourcesFile, "utf8"),
		]);
		const authorization = authorizationHeader(authContents);
		const sources = parseSources(JSON.parse(sourcesContents));
		const [pageResponse, descriptionsResponse] = await Promise.all([
			fetchApi(`${options.baseUrl}/projects`, {
				headers: { Authorization: authorization },
				redirect: "error",
			}),
			fetchApi(`${options.baseUrl}/api/project-descriptions`, {
				headers: { Authorization: authorization },
				redirect: "error",
			}),
		]);
		if (!pageResponse.ok) throw new Error(`archive page request failed (${pageResponse.status})`);
		const descriptions = descriptionState(
			await responseJson(descriptionsResponse, "description state request"),
		);
		const records = selectItems(extractArchiveContext(await pageResponse.text()), options.scope)
			.filter((record) => sources.has(`${record.kind}:${record.id}`))
			.slice(0, options.maxItems);
		const repositoryIndex =
			dependencies.repositoryIndex ??
			(await discoverLocalRepositories({
				home,
				run,
				fsApi,
				repositories: [...sources.values()].flat(),
			}));
		const state = await readState(options.stateFile, fsApi);

		for (const record of records) {
			const key = `${record.kind}:${record.id}`;
			const checkedAt = now();
			const prior = state.items[key];
			const itemState = newItemState(prior, checkedAt);
			delete itemState.lastError;
			try {
				if (validDescription(descriptions.candidates[record.kind][record.id])) {
					itemState.lastStatus = "candidate-pending";
					itemState.lastCommitCount = 0;
					state.items[key] = itemState;
					state.updatedAt = checkedAt;
					await atomicWriteJson(options.stateFile, state, fsApi);
					log(`${key} candidate-pending`);
					continue;
				}
				const configured = sources.get(key);
				const observed = [];
				for (const repository of configured) {
					const repositoryPath = repositoryIndex.get(repository.toLowerCase());
					if (repositoryPath) {
						observed.push({
							repository,
							kind: "local",
							path: repositoryPath,
							head: await repositoryHead(repositoryPath, run),
						});
					} else {
						observed.push({
							repository,
							kind: "remote",
							head: await remoteRepositoryHead(repository, run),
						});
					}
				}

				const missingSources = observed.filter(
					({ repository }) => !itemState.sources[repository]?.head,
				);
				let bootstrappedSources = false;
				if (missingSources.length > 0 && !options.force) {
					for (const source of missingSources) {
						itemState.sources[source.repository] = {
							head: source.head,
							observedAt: checkedAt,
						};
					}
					bootstrappedSources = true;
					if (missingSources.length === observed.length) {
						itemState.lastStatus = "bootstrapped";
						itemState.lastCommitCount = 0;
						state.items[key] = itemState;
						state.updatedAt = checkedAt;
						await atomicWriteJson(options.stateFile, state, fsApi);
						log(`${key} bootstrapped`);
						continue;
					}
				}

				const changed = observed.filter(
					(source) => options.force || itemState.sources[source.repository]?.head !== source.head,
				);
				if (changed.length === 0) {
					itemState.lastStatus = bootstrappedSources ? "bootstrapped" : "unchanged";
					itemState.lastCommitCount = 0;
					state.items[key] = itemState;
					state.updatedAt = checkedAt;
					await atomicWriteJson(options.stateFile, state, fsApi);
					log(`${key} ${itemState.lastStatus}`);
					continue;
				}

				const evidenceParts = [];
				let commitCount = 0;
				for (let index = 0; index < changed.length; index += 1) {
					const source = changed[index];
					const evidenceOptions = {
						previousHead: itemState.sources[source.repository]?.head,
						currentHead: source.head,
						force: options.force,
						sourceNumber: index + 1,
						repositories: configured,
						run,
					};
					const gathered =
						source.kind === "local"
							? await committedEvidence(source.path, evidenceOptions)
							: await remoteCommittedEvidence(source.repository, evidenceOptions);
					commitCount += gathered.commits.length;
					if (gathered.text) evidenceParts.push(gathered.text);
				}
				const evidence = evidenceParts.join("\n").slice(0, MAX_EVIDENCE);
				if (!evidence) {
					for (const source of observed) {
						itemState.sources[source.repository] = {
							head: source.head,
							observedAt: checkedAt,
						};
					}
					itemState.lastStatus = "no-commits";
					itemState.lastCommitCount = 0;
					state.items[key] = itemState;
					state.updatedAt = checkedAt;
					await atomicWriteJson(options.stateFile, state, fsApi);
					log(`${key} no-commits`);
					continue;
				}

				const previewResponse = await fetchApi(
					`${options.baseUrl}/api/project-descriptions`,
					{
						method: "POST",
						headers: {
							Authorization: authorization,
							"Content-Type": "application/json",
							Origin: requestOrigin,
						},
						body: JSON.stringify({
							...record,
							draft: draftBase(record, descriptions),
							evidence,
						}),
					},
				);
				const preview = await responseJson(previewResponse, "preview request");
				if (typeof preview.preview !== "string" || !preview.preview.trim()) {
					throw new Error("preview request returned an empty draft");
				}

				if (options.apply) {
					const stageResponse = await fetchApi(
						`${options.baseUrl}/api/project-descriptions`,
						{
							method: "PATCH",
							headers: {
								Authorization: authorization,
								"Content-Type": "application/json",
								Origin: requestOrigin,
							},
							body: JSON.stringify({
								kind: record.kind,
								id: record.id,
								action: "stage",
								description: preview.preview,
								evidence,
							}),
						},
					);
					await responseJson(stageResponse, "candidate stage request");
					for (const source of observed) {
						itemState.sources[source.repository] = {
							head: source.head,
							observedAt: checkedAt,
						};
					}
					itemState.lastStatus = "staged";
					log(`${key} staged`);
				} else {
					itemState.lastStatus = "dry-run";
					log(`${key} dry-run`);
				}
				itemState.lastCommitCount = commitCount;
				state.items[key] = itemState;
				state.updatedAt = checkedAt;
				await atomicWriteJson(options.stateFile, state, fsApi);
			} catch (caught) {
				failures += 1;
				itemState.lastStatus = "failed";
				itemState.lastError = caught instanceof Error ? caught.message.slice(0, 300) : "unknown failure";
				state.items[key] = itemState;
				state.updatedAt = checkedAt;
				await atomicWriteJson(options.stateFile, state, fsApi);
				log(`${key} failed`);
			}
		}
		return { exitCode: failures > 0 ? 1 : 0, failures, processed: records.length };
	} finally {
		await release();
	}
}

export async function main(argv = process.argv.slice(2)) {
	const options = parseArgs(argv);
	const result = await runArchiveRefresh(options);
	return result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main()
		.then((exitCode) => {
			process.exitCode = exitCode;
		})
		.catch((caught) => {
			console.error(caught instanceof Error ? caught.message : "archive refresh failed");
			process.exitCode = 1;
		});
}
