import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const builder = join(repoRoot, "scripts", "bgm-build.sh");
const refresher = join(repoRoot, "scripts", "moodboard-auto-refresh.sh");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bgm-build-test-"));
  mkdirSync(join(root, "audio"), { recursive: true });
  mkdirSync(join(root, "public"), { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-nostdin", "-loglevel", "error",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=0.15",
    "-q:a", "9", join(root, "audio", "quoted-\"track.mp3"),
  ]);
  writeFileSync(join(root, "audio", "quoted-\"track.txt"), "non-audio sidecar\n");
  return root;
}

function runBuilder(root, extraEnv = {}) {
  return spawnSync("bash", [builder], {
    cwd: repoRoot,
    env: { ...process.env, BGM_ROOT_DIR: root, ...extraEnv },
    encoding: "utf8",
  });
}

function outputSnapshot(root) {
  const output = join(root, "public", "audio");
  const names = readdirSync(output).sort();
  return names.map((name) => [name, readFileSync(join(output, name)).toString("base64")]);
}

test("audio build publishes valid content-addressed outputs transactionally", () => {
  const root = fixture();
  try {
    const result = runBuilder(root);
    assert.equal(result.status, 0, result.stderr);

    const manifest = JSON.parse(readFileSync(join(root, "public", "audio", "manifest.json"), "utf8"));
    assert.equal(manifest.length, 1);
    assert.equal(manifest[0].slug, "quoted-\"track");
    assert.match(manifest[0].src, /^\/audio\/[a-f0-9]{20}\.mp3$/);
    assert.ok(existsSync(join(root, "public", manifest[0].src)));

    const first = outputSnapshot(root);
    const secondRun = runBuilder(root);
    assert.equal(secondRun.status, 0, secondRun.stderr);
    assert.deepEqual(outputSnapshot(root), first, "same source must produce stable manifest and bytes");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("failed conversion preserves the previously published directory", () => {
  const root = fixture();
  try {
    const initial = runBuilder(root);
    assert.equal(initial.status, 0, initial.stderr);
    const before = outputSnapshot(root);

    const fakeBin = join(root, "fake-bin");
    mkdirSync(fakeBin);
    writeFileSync(join(fakeBin, "ffmpeg"), "#!/usr/bin/env bash\nexit 42\n", { mode: 0o755 });
    const failed = runBuilder(root, { PATH: `${fakeBin}:${process.env.PATH}` });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /failed to convert/);
    assert.deepEqual(outputSnapshot(root), before, "failed build changed published output");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("duplicate slugs fail closed without replacing published output", () => {
  const root = fixture();
  try {
    const initial = runBuilder(root);
    assert.equal(initial.status, 0, initial.stderr);
    const before = outputSnapshot(root);
    cpSync(join(root, "audio", "quoted-\"track.mp3"), join(root, "audio", "quoted-\"track.wav"));

    const failed = runBuilder(root);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /duplicate audio slug/);
    assert.deepEqual(outputSnapshot(root), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("asset refresher serializes, isolates, scopes, and receipts publication", () => {
  const source = readFileSync(refresher, "utf8");
  assert.match(source, /flock -n/);
  assert.match(source, /worktree add --quiet --detach/);
  assert.match(source, /git -C "\$worktree" add -- public\/audio\//);
  assert.match(source, /git -C "\$worktree" add -- public\/moodboard\//);
  assert.match(source, /MERULOX_ASSET_AUTODEPLOY_DRY_RUN/);
  assert.match(source, /source changed during build; deferring/);
  assert.ok(source.indexOf("deploy_commit") < source.indexOf('write_state "$audio_state_file"'));
  assert.ok(source.indexOf("git -C \"$worktree\" push") < source.indexOf("deploy_commit \"$candidate_commit\""));
});

test("audio-only refresher publishes from a worktree, receipts success, and ignores mtime-only retriggers", { timeout: 60_000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "asset-refresh-test-"));
  const seed = join(root, "seed");
  const remote = join(root, "remote.git");
  const state = join(root, "state");
  const fakeBin = join(root, "fake-bin");
  const production = join(root, "production");
  const deployLog = join(root, "deploy.log");

  const git = (args, options = {}) => execFileSync("git", args, {
    cwd: options.cwd ?? seed,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  }).trim();
  const executable = (name, contents) => writeFileSync(join(fakeBin, name), contents, { mode: 0o755 });

  try {
    mkdirSync(join(seed, "scripts"), { recursive: true });
    mkdirSync(join(seed, "public", "audio"), { recursive: true });
    mkdirSync(join(seed, "public", "moodboard"), { recursive: true });
    mkdirSync(fakeBin);
    mkdirSync(state);
    mkdirSync(production);
    cpSync(builder, join(seed, "scripts", "bgm-build.sh"));
    cpSync(refresher, join(seed, "scripts", "moodboard-auto-refresh.sh"));
    writeFileSync(join(seed, ".gitignore"), "/audio/\n/moodboard/\n/dist/\n/node_modules/\n");
    writeFileSync(join(seed, "package.json"), "{\"scripts\":{\"build\":\"true\"}}\n");
    writeFileSync(join(seed, "package-lock.json"), "{\"name\":\"fixture\",\"lockfileVersion\":3,\"packages\":{}}\n");
    writeFileSync(join(seed, "public", "audio", "manifest.json"), "[]\n");
    writeFileSync(join(seed, "public", "moodboard", "manifest.json"), "[]\n");

    execFileSync("git", ["init", "--bare", remote]);
    git(["init", "-b", "main"]);
    git(["add", "."]);
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture"]);
    git(["remote", "add", "origin", remote]);
    git(["push", "-u", "origin", "main"]);

    mkdirSync(join(seed, "audio"));
    mkdirSync(join(seed, "moodboard"));
    execFileSync("ffmpeg", [
      "-y", "-nostdin", "-loglevel", "error",
      "-f", "lavfi", "-i", "sine=frequency=523:duration=0.15",
      "-q:a", "9", join(seed, "audio", "fixture.mp3"),
    ]);
    const moodHash = execFileSync("bash", ["-c",
      "find moodboard -type f -printf '%p %s %T@\\n' 2>/dev/null | sort | sha256sum | cut -d' ' -f1",
    ], { cwd: seed, encoding: "utf8" }).trim();
    writeFileSync(join(state, "moodboard-source.sha256"), `${moodHash}\n`);

    executable("npm", `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "ci" ]]; then mkdir -p node_modules; exit 0; fi
if [[ "\${1:-} \${2:-}" == "run build" ]]; then rm -rf dist; mkdir -p dist; cp -a public/. dist/; exit 0; fi
exit 64
`);
    executable("npx", `#!/usr/bin/env bash
set -euo pipefail
printf 'deploy\\n' >> "$FAKE_DEPLOY_LOG"
rm -rf "$FAKE_PRODUCTION_ROOT"
mkdir -p "$FAKE_PRODUCTION_ROOT"
cp -a public/. "$FAKE_PRODUCTION_ROOT/"
`);
    executable("curl", `#!/usr/bin/env bash
set -euo pipefail
output=""
url=""
while (($#)); do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    http*) url="$1"; shift ;;
    *) shift ;;
  esac
done
if [[ -z "$output" ]]; then exit 0; fi
case "$url" in
  */audio/manifest.json*) cp "$FAKE_PRODUCTION_ROOT/audio/manifest.json" "$output" ;;
  */moodboard/manifest.json*) cp "$FAKE_PRODUCTION_ROOT/moodboard/manifest.json" "$output" ;;
  *) exit 22 ;;
esac
`);

    const env = {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      MERULOX_ASSET_REPO_ROOT: seed,
      MERULOX_ASSET_STATE_DIR: state,
      MERULOX_ASSET_STABILITY_WAIT_SECONDS: "0",
      MERULOX_PRODUCTION_URL: "https://fixture.invalid",
      FAKE_PRODUCTION_ROOT: production,
      FAKE_DEPLOY_LOG: deployLog,
    };
    const first = spawnSync("bash", [join(seed, "scripts", "moodboard-auto-refresh.sh")], {
      cwd: seed, env, encoding: "utf8",
    });
    assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
    assert.match(first.stdout, /static asset refresh complete/);
    assert.ok(existsSync(join(state, "audio-source.sha256")));
    assert.equal(readFileSync(deployLog, "utf8"), "deploy\n");

    const remoteManifest = JSON.parse(git(["--git-dir", remote, "show", "main:public/audio/manifest.json"]));
    assert.equal(remoteManifest.length, 1);
    assert.match(remoteManifest[0].src, /^\/audio\/[a-f0-9]{20}\.mp3$/);
    assert.deepEqual(
      JSON.parse(readFileSync(join(production, "audio", "manifest.json"), "utf8")),
      remoteManifest,
    );

    const remoteHead = git(["--git-dir", remote, "rev-parse", "main"]);
    const audioPath = join(seed, "audio", "fixture.mp3");
    const now = new Date();
    utimesSync(audioPath, now, now);
    const second = spawnSync("bash", [join(seed, "scripts", "moodboard-auto-refresh.sh")], {
      cwd: seed, env, encoding: "utf8",
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(git(["--git-dir", remote, "rev-parse", "main"]), remoteHead);
    assert.equal(readFileSync(deployLog, "utf8"), "deploy\n", "mtime-only trigger redeployed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
