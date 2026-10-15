const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");

function loadRunner(overrides = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("RENOVATE_") && !key.startsWith("GITHUB_"),
    ),
  );
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      'process.stdout.write(JSON.stringify(require("./.github/renovate-config.js")))',
    ],
    {
      cwd: root,
      env: { ...env, GITHUB_REPOSITORY: "fork/runner", ...overrides },
      encoding: "utf8",
    },
  );
  return result;
}

function config(overrides) {
  const result = loadRunner(overrides);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("forks default to Conventional Commits with native runner defaults", () => {
  const runner = config();
  assert.deepEqual(runner.extends, [
    "github>fork/runner",
    "github>fork/runner:conventional",
  ]);
  assert.equal(runner.onboarding, false);
  assert.equal(runner.requireConfig, "optional");
  assert.equal(runner.forkProcessing, "enabled");
  assert.equal(runner.dependencyDashboard, true);
});

test("GitMoji override retains the base preset", () => {
  assert.deepEqual(config({ RENOVATE_COMMIT_STYLE: "gitmoji" }).extends, [
    "github>fork/runner",
    "github>fork/runner:gitmoji",
  ]);
});

test("existing explicit GitMoji presets remain compatible", () => {
  const runner = config({
    RENOVATE_CONFIG_PRESET: "github>fork/runner:gitmoji",
  });
  assert.deepEqual(runner.extends, ["github>fork/runner:gitmoji"]);
  const conventional = config({
    RENOVATE_CONFIG_PRESET: "github>fork/runner:gitmoji",
    RENOVATE_COMMIT_STYLE: "conventional",
  });
  assert.equal(conventional.extends.at(-1), "github>fork/runner:conventional");
});

test("style selection preserves custom base presets", () => {
  assert.deepEqual(
    config({
      RENOVATE_CONFIG_PRESET: "github>team/presets",
      RENOVATE_COMMIT_STYLE: "gitmoji",
    }).extends,
    ["github>team/presets", "github>fork/runner:gitmoji"],
  );
});

test("style selection preserves targeted runs and discovery", () => {
  const target = config({
    RENOVATE_COMMIT_STYLE: "gitmoji",
    RENOVATE_REPOSITORY: " team/app ",
  });
  assert.deepEqual(target.repositories, ["team/app"]);
  assert.equal(target.autodiscover, undefined);
  const discovery = config();
  assert.equal(discovery.autodiscover, true);
  assert.deepEqual(discovery.autodiscoverFilter, ["fork/*"]);
  assert.deepEqual(discovery.autodiscoverTopics, ["renovate"]);
});

test("unknown commit styles fail with an actionable error", () => {
  const result = loadRunner({ RENOVATE_COMMIT_STYLE: "typo" });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /RENOVATE_COMMIT_STYLE must be conventional or gitmoji/,
  );
});
