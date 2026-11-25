import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => readFileSync(join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
// The image exposes a shell wrapper on PATH; use its packaged JS directly.
const validator = process.env.PATH.split(delimiter)
  .map((dir) => join(dir, "renovate-config-validator"))
  .find(existsSync);
const dist = existsSync("/usr/local/renovate/dist/config-validator.js")
  ? "/usr/local/renovate/dist"
  : dirname(realpathSync(validator));
const load = (file) => import(pathToFileURL(join(dist, file)));
const { getConfig } = await load("config/defaults.js");
const { GlobalConfig } = await load("config/global.js");
const { mergeChildConfig } = await load("config/utils.js");
const { resolveConfigPresets } = await load("config/presets/index.js");
const { applyPackageRules } = await load("util/package-rules/index.js");
const { checkMinimumReleaseAge } = await load("util/minimum-release-age.js");
const { filterInternalChecks } = await load(
  "workers/repository/process/lookup/filter-checks.js",
);
const { api: semver } = await load("modules/versioning/semver/index.js");
const { flattenUpdates } = await load("workers/repository/updates/flatten.js");
const { extractPackageFile } = await load(
  "modules/manager/github-actions/extract.js",
);
const { getChildEnv } = await load("util/exec/utils.js");
const { setCustomEnv } = await load("util/env.js");
const { init: initLogger } = await load("logger/index.js");
await initLogger();

async function policy(files = ["default.json"]) {
  let config = getConfig();
  for (const file of files) {
    config = mergeChildConfig(
      config,
      (await resolveConfigPresets(json(file))).config,
    );
  }
  return config;
}
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const dep = (extra = {}) => ({
  manager: "mise",
  datasource: "github-releases",
  depName: "example",
  packageName: "example",
  currentVersion: "1.0.0",
  updateType: "patch",
  ...extra,
});

test("fresh releases wait; an older eligible version is selected", async () => {
  const config = { ...(await policy()), ...dep() };
  const fresh = { version: "1.0.2", releaseTimestamp: daysAgo(2) };
  assert.equal(
    (await filterInternalChecks(config, semver, "patch", [fresh]))
      .pendingChecks,
    true,
  );
  const result = await filterInternalChecks(config, semver, "patch", [
    { version: "1.0.1", releaseTimestamp: daysAgo(8) },
    fresh,
  ]);
  assert.equal(result.pendingChecks, false);
  assert.equal(result.release.version, "1.0.1");
});

test("missing timestamps stay eligible for manual review in every shipped composition", async () => {
  for (const files of [
    ["default.json"],
    ["default.json", "automerge.json"],
    ["default.json", ".renovaterc.json5"],
  ]) {
    const config = { ...(await policy(files)), ...dep() };
    const result = await filterInternalChecks(config, semver, "patch", [
      { version: "1.0.1" },
    ]);
    assert.equal(result.pendingChecks, false, files.join(" + "));
    const effective = await applyPackageRules(config);
    assert.equal(effective.automerge, false);
  }
});

test("bumps remain manual regardless of shipped preset ordering", async () => {
  for (const files of [
    ["default.json", "automerge.json"],
    ["automerge.json", "default.json"],
    ["default.json", ".renovaterc.json5"],
  ]) {
    const effective = await applyPackageRules({
      ...(await policy(files)),
      ...dep({
        manager: "github-actions",
        isBump: true,
        releaseTimestamp: daysAgo(20),
      }),
    });
    assert.equal(effective.automerge, false, files.join(" + "));
    assert.equal(effective.minimumReleaseAge, null);
  }
});

test("automerge waits fourteen days; major and security fixes stay manual", async () => {
  for (const files of [
    ["default.json", "automerge.json"],
    ["default.json", ".renovaterc.json5"],
  ]) {
    const config = await policy(files);
    for (const manager of ["github-actions", "pre-commit"]) {
      const effective = await applyPackageRules({
        ...config,
        ...dep({ manager, releaseTimestamp: daysAgo(8) }),
      });
      assert.equal(effective.automerge, true);
      assert.equal(
        checkMinimumReleaseAge(effective, daysAgo(8)).isPending,
        true,
      );
      assert.equal(
        checkMinimumReleaseAge(effective, daysAgo(15)).isPending,
        false,
      );
      const major = await applyPackageRules({
        ...config,
        ...dep({ manager, updateType: "major", releaseTimestamp: daysAgo(20) }),
      });
      assert.equal(major.automerge, false);
      const security = await applyPackageRules({
        ...effective,
        force: config.vulnerabilityAlerts,
      });
      assert.equal(security.automerge, false);
      assert.equal(
        checkMinimumReleaseAge(security, daysAgo(0)).isPending,
        false,
      );
    }
  }
});

test("native pep621 lockfile maintenance is weekly and manually reviewed", async () => {
  const config = await policy(["default.json", "automerge.json"]);
  const updates = await flattenUpdates(config, {
    pep621: [
      { packageFile: "pyproject.toml", lockFiles: ["uv.lock"], deps: [] },
    ],
  });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].isLockFileMaintenance, true);
  assert.equal(updates[0].automerge, false);
  assert.equal(updates[0].minimumReleaseAge, null);
  assert.deepEqual(updates[0].schedule, ["before 4am on monday"]);
});

test("runner does not inject a global UV_EXCLUDE_NEWER cutoff into child processes", () => {
  const runner = createRequire(import.meta.url)(
    join(root, ".github/renovate-config.js"),
  );
  GlobalConfig.set({ ...getConfig(), ...runner, localDir: root });
  // Native parseConfigs initializes this process-level environment store.
  setCustomEnv(runner.customEnvVariables ?? {});
  assert.equal(runner.customEnvVariables?.UV_EXCLUDE_NEWER, undefined);
  assert.equal(getChildEnv().UV_EXCLUDE_NEWER, undefined);
});

test("runner and validation use one digest-pinned image that Renovate can update", async () => {
  const images = [];
  for (const name of ["renovate", "validate"]) {
    const file = `.github/workflows/${name}.yaml`;
    const extracted = await extractPackageFile(read(file), file, {});
    const image = extracted.deps.find(
      (item) => item.packageName === "ghcr.io/renovatebot/renovate",
    );
    assert.ok(image, file);
    assert.match(image.currentDigest, /^sha256:[a-f0-9]{64}$/);
    images.push([image.currentValue, image.currentDigest]);
  }
  assert.deepEqual(images[0], images[1]);
  assert.match(
    read(".github/workflows/renovate.yaml"),
    /group: \$\{\{ github.workflow \}\}\n/,
  );
});
