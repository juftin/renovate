// $schema: "https://docs.renovatebot.com/renovate-schema.json"

const gitAuthor = process.env.GIT_AUTHOR;

const targetRepo =
  process.env.RENOVATE_REPOSITORY &&
  process.env.RENOVATE_REPOSITORY.trim() !== ""
    ? process.env.RENOVATE_REPOSITORY.trim()
    : null;

const currentRepo = process.env.GITHUB_REPOSITORY;
const defaultOwner =
  process.env.GITHUB_REPOSITORY_OWNER ||
  (currentRepo ? currentRepo.split("/")[0] : undefined);

let autodiscoverFilter = defaultOwner ? [`${defaultOwner}/*`] : ["*/*"];
if (process.env.RENOVATE_AUTODISCOVER_FILTER) {
  try {
    const parsed = JSON.parse(process.env.RENOVATE_AUTODISCOVER_FILTER);
    autodiscoverFilter = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    autodiscoverFilter = [process.env.RENOVATE_AUTODISCOVER_FILTER];
  }
}

let autodiscoverTopics = ["renovate"];
if (process.env.RENOVATE_AUTODISCOVER_TOPICS) {
  try {
    const parsed = JSON.parse(process.env.RENOVATE_AUTODISCOVER_TOPICS);
    autodiscoverTopics = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    autodiscoverTopics = [process.env.RENOVATE_AUTODISCOVER_TOPICS];
  }
}

const defaultPreset =
  process.env.RENOVATE_CONFIG_PRESET ||
  (currentRepo
    ? `github>${currentRepo}`
    : defaultOwner
      ? `github>${defaultOwner}/renovate`
      : null);

const isConventional =
  (process.env.RENOVATE_CONFIG_PRESET &&
    process.env.RENOVATE_CONFIG_PRESET.includes("conventional")) ||
  false;

const defaultOnboardingPrTitle = isConventional
  ? "chore: configure renovate"
  : "👷 configure renovate";

const defaultOnboardingCommitMessage = isConventional
  ? "chore: configure renovate"
  : "👷 configure renovate";

let globalExtends = defaultPreset ? [defaultPreset] : [];
if (process.env.RENOVATE_GLOBAL_EXTENDS) {
  try {
    const parsed = JSON.parse(process.env.RENOVATE_GLOBAL_EXTENDS);
    globalExtends = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    globalExtends = [process.env.RENOVATE_GLOBAL_EXTENDS];
  }
}

// Instrument global Error to print full stack trace on REPOSITORY_CHANGED
if (!global._patchedForRenovateErrors) {
  const OriginalError = global.Error;
  global.Error = function (message, ...args) {
    const err = new OriginalError(message, ...args);
    if (message === "repository-changed") {
      console.error("RENOVATE_ABORT_TRACE:\n" + (err.stack || message));
    }
    return err;
  };
  global.Error.prototype = OriginalError.prototype;
  global._patchedForRenovateErrors = true;
}

// Format JSON output from Renovate's JSONWriter to match Prettier conventions
// (single-line arrays when within standard line length limits)
try {
  const path = require("path");
  const editorConfigKey = Object.keys(require.cache).find(
    (k) => k.includes("editor-config") || k.includes("json-writer")
  );
  let JSONWriter;
  if (editorConfigKey) {
    const jsonWriterPath = path.join(path.dirname(editorConfigKey), "json-writer.js");
    JSONWriter = require(jsonWriterPath).JSONWriter;
  }
  if (!JSONWriter) {
    const mainDir = require.main?.filename ? path.dirname(require.main.filename) : "";
    const candidatePath = path.join(mainDir, "util/json-writer/json-writer.js");
    const fs = require("fs");
    if (fs.existsSync(candidatePath)) {
      JSONWriter = require(candidatePath).JSONWriter;
    }
  }
  if (JSONWriter && JSONWriter.prototype && !JSONWriter.prototype._patchedForPrettier) {
    const originalWrite = JSONWriter.prototype.write;
    JSONWriter.prototype.write = function (json, newLineAtTheEnd = true) {
      const content = originalWrite.call(this, json, newLineAtTheEnd);
      // Prettier places short arrays of primitives on a single line
      return content.replace(
        /^(\s*)"([^"]+)": \[\n((?:\s*"[^"]*",?\n)+)\s*\]/gm,
        (match, indent, key, itemsStr) => {
          try {
            const items = itemsStr
              .trim()
              .split("\n")
              .map((l) => l.trim().replace(/,$/, ""))
              .map((s) => JSON.stringify(JSON.parse(s)));
            const singleLine = `${indent}"${key}": [${items.join(", ")}]`;
            if (singleLine.length <= 80) {
              return singleLine;
            }
          } catch {}
          return match;
        }
      );
    };
    JSONWriter.prototype._patchedForPrettier = true;
  }
} catch {
  // Graceful fallback if not running within Renovate execution context
}

// Ensure Gitmoji onboarding PR titles are not prepended with "chore: "
// by Renovate's default getSemanticCommitPrTitle
try {
  const path = require("path");
  const mainDir = require.main?.filename ? path.dirname(require.main.filename) : "";
  const fs = require("fs");

  let common;
  const commonCandidate = path.join(mainDir, "workers/repository/onboarding/common.js");
  if (fs.existsSync(commonCandidate)) {
    common = require(commonCandidate);
  }
  if (!common) {
    const commonKey = Object.keys(require.cache).find(
      (k) =>
        k.includes("workers/repository/onboarding/common") ||
        k.includes("onboarding/common.js")
    );
    if (commonKey) {
      common = require(commonKey);
    }
  }
  if (
    common &&
    typeof common.getSemanticCommitPrTitle === "function" &&
    !common.getSemanticCommitPrTitle._patchedForGitmoji
  ) {
    const originalGetSemanticCommitPrTitle = common.getSemanticCommitPrTitle;
    common.getSemanticCommitPrTitle = function (config) {
      if (
        config.onboardingPrTitle &&
        (/\p{Extended_Pictographic}/u.test(config.onboardingPrTitle) ||
          /^[a-z]+(\([a-z0-9_-]+\))?:/u.test(config.onboardingPrTitle))
      ) {
        return config.onboardingPrTitle;
      }
      return originalGetSemanticCommitPrTitle.call(this, config);
    };
    common.getSemanticCommitPrTitle._patchedForGitmoji = true;
  }

  // Also patch platform APIs (e.g. GitHub) so createPr, updatePr, and getBranchPr
  // strip accidental "chore: " prefix from gitmoji titles and repair existing onboarding PRs
  let api;
  const apiCandidate = path.join(mainDir, "modules/platform/api.js");
  if (fs.existsSync(apiCandidate)) {
    api = require(apiCandidate);
  }
  if (!api) {
    const apiKey = Object.keys(require.cache).find((k) =>
      k.includes("modules/platform/api")
    );
    if (apiKey) {
      api = require(apiKey);
    }
  }
  if (api && api.default) {
    for (const [name, platformApi] of api.default.entries()) {
      if (platformApi && !platformApi._patchedForGitmoji) {
        const proxy = new Proxy(platformApi, {
          get(target, prop, receiver) {
            if (prop === "_patchedForGitmoji") {
              return true;
            }
            if (prop === "createPr") {
              return function (options, ...args) {
                if (
                  options &&
                  options.prTitle &&
                  options.prTitle.startsWith("chore: 👷")
                ) {
                  options.prTitle = options.prTitle.replace(/^chore:\s*/, "");
                }
                return target.createPr.call(target, options, ...args);
              };
            }
            if (prop === "updatePr") {
              return function (options, ...args) {
                if (
                  options &&
                  options.prTitle &&
                  options.prTitle.startsWith("chore: 👷")
                ) {
                  options.prTitle = options.prTitle.replace(/^chore:\s*/, "");
                }
                return target.updatePr.call(target, options, ...args);
              };
            }
            if (prop === "getBranchPr") {
              return async function (branchName, ...args) {
                const pr = await target.getBranchPr.call(
                  target,
                  branchName,
                  ...args
                );
                if (pr && pr.title && pr.title.startsWith("chore: 👷")) {
                  if (pr.bodyStruct) {
                    pr.bodyStruct.hash = null;
                  }
                  pr.title = pr.title.replace(/^chore:\s*/, "");
                }
                return pr;
              };
            }
            if (prop === "getPrList") {
              return async function (...args) {
                const list = await target.getPrList.call(target, ...args);
                if (Array.isArray(list)) {
                  for (const pr of list) {
                    if (pr && pr.title && pr.title.startsWith("chore: 👷")) {
                      if (pr.bodyStruct) {
                        pr.bodyStruct.hash = null;
                      }
                      pr.title = pr.title.replace(/^chore:\s*/, "");
                    }
                  }
                }
                return list;
              };
            }
            if (prop === "findPr") {
              return async function (options, ...args) {
                let pr = await target.findPr.call(target, options, ...args);
                if (!pr && options) {
                  if (
                    options.branchName &&
                    (options.branchName === "renovate/configure" ||
                      options.branchName.endsWith("/configure"))
                  ) {
                    // If searching for an onboarding PR, also match any closed PR on this branch
                    const newOpt = { ...options };
                    delete newOpt.prTitle;
                    pr = await target.findPr.call(target, newOpt, ...args);
                  } else if (options.prTitle) {
                    // Try matching alternate title format (with or without 'chore: ' prefix)
                    const altTitle = options.prTitle.startsWith("chore: ")
                      ? options.prTitle.replace(/^chore:\s*/, "")
                      : `chore: ${options.prTitle}`;
                    pr = await target.findPr.call(
                      target,
                      { ...options, prTitle: altTitle },
                      ...args
                    );
                  }
                }
                if (pr && pr.title && pr.title.startsWith("chore: 👷")) {
                  if (pr.bodyStruct) {
                    pr.bodyStruct.hash = null;
                  }
                  pr.title = pr.title.replace(/^chore:\s*/, "");
                }
                return pr;
              };
            }
            if (prop === "setBranchStatus") {
              return async function (...args) {
                try {
                  return await target.setBranchStatus.call(target, ...args);
                } catch {
                  // Never let status check errors (e.g. 404/403 when GitHub App lacks status permissions)
                  // throw REPOSITORY_CHANGED and crash the entire renovation run.
                  return;
                }
              };
            }
            if (prop === "getBranchStatusCheck") {
              return async function (...args) {
                try {
                  return await target.getBranchStatusCheck.call(target, ...args);
                } catch {
                  return null;
                }
              };
            }
            if (prop === "getBranchStatus") {
              return async function (...args) {
                try {
                  return await target.getBranchStatus.call(target, ...args);
                } catch {
                  return "yellow";
                }
              };
            }
            if (prop === "findIssue") {
              return async function (title, ...args) {
                let issue = await target.findIssue.call(target, title, ...args);
                if (!issue && title === "Renovate Dashboard 🤖") {
                  issue = await target.findIssue.call(
                    target,
                    "Dependency Dashboard",
                    ...args
                  );
                } else if (!issue && title === "Dependency Dashboard") {
                  issue = await target.findIssue.call(
                    target,
                    "Renovate Dashboard 🤖",
                    ...args
                  );
                }
                return issue;
              };
            }
            return Reflect.get(target, prop, receiver);
          },
        });
        api.default.set(name, proxy);
      }
    }
  }

  // Patch SCM implementation (e.g. GithubScm) to prevent branch push failures
  // or git bad revision errors from aborting the entire renovation run
  let scmMod;
  const scmCandidate = path.join(mainDir, "modules/platform/scm.js");
  if (fs.existsSync(scmCandidate)) {
    scmMod = require(scmCandidate);
  }
  if (!scmMod) {
    const scmKey = Object.keys(require.cache).find((k) =>
      k.includes("modules/platform/scm")
    );
    if (scmKey) {
      scmMod = require(scmKey);
    }
  }
  if (
    scmMod &&
    scmMod.platformScmImpls &&
    scmMod.platformScmImpls.has("github")
  ) {
    const OrigGithubScm = scmMod.platformScmImpls.get("github");
    if (!OrigGithubScm._patchedForSafety) {
      class SafeGithubScm extends OrigGithubScm {
        async mergeAndPush(...args) {
          try {
            return await super.mergeAndPush(...args);
          } catch (err) {
            console.warn(
              "Safeguarded scm.mergeAndPush error:",
              err?.message || err
            );
            throw new Error("failed");
          }
        }
        async isBranchModified(...args) {
          try {
            return await super.isBranchModified(...args);
          } catch (err) {
            console.warn(
              "Safeguarded scm.isBranchModified error:",
              err?.message || err
            );
            return false;
          }
        }
      }
      SafeGithubScm._patchedForSafety = true;
      scmMod.platformScmImpls.set("github", SafeGithubScm);
    }
  }

  // Ensure Dependency Dashboard is always generated for downstream repositories,
  // even if onboarding status was not marked or config is optional
  let depDashboard;
  const depDashboardCandidate = path.join(
    mainDir,
    "workers/repository/dependency-dashboard.js"
  );
  if (fs.existsSync(depDashboardCandidate)) {
    depDashboard = require(depDashboardCandidate);
  }
  if (!depDashboard) {
    const ddKey = Object.keys(require.cache).find(
      (k) =>
        k.includes("workers/repository/dependency-dashboard") ||
        k.includes("dependency-dashboard.js")
    );
    if (ddKey) {
      depDashboard = require(ddKey);
    }
  }
  if (
    depDashboard &&
    typeof depDashboard.ensureDependencyDashboard === "function" &&
    !depDashboard.ensureDependencyDashboard._patchedForDashboard
  ) {
    const origEnsureDependencyDashboard =
      depDashboard.ensureDependencyDashboard;
    depDashboard.ensureDependencyDashboard = async function (
      config,
      allBranches,
      packageFiles = {},
      configMigrationRes = { result: "no-config" }
    ) {
      if (config && config.dependencyDashboard !== false) {
        config = {
          ...config,
          dependencyDashboard: true,
          repoIsOnboarded: true,
          dependencyDashboardTitle:
            config.dependencyDashboardTitle || "Renovate Dashboard 🤖",
        };
      }
      return origEnsureDependencyDashboard.call(
        this,
        config,
        allBranches,
        packageFiles,
        configMigrationRes
      );
    };
    depDashboard.ensureDependencyDashboard._patchedForDashboard = true;
  }

  // Patch extractDependencies to retain extracted branches and package files
  // so they are available to ensure Dependency Dashboard even if an update fails
  let procMod;
  const procCandidate = path.join(
    mainDir,
    "workers/repository/process/index.js"
  );
  if (fs.existsSync(procCandidate)) {
    procMod = require(procCandidate);
  }
  if (!procMod) {
    const procKey = Object.keys(require.cache).find((k) =>
      k.includes("workers/repository/process/index")
    );
    if (procKey) {
      procMod = require(procKey);
    }
  }
  if (
    procMod &&
    typeof procMod.extractDependencies === "function" &&
    !procMod.extractDependencies._patchedForDashboard
  ) {
    const origExtractDependencies = procMod.extractDependencies;
    procMod.extractDependencies = async function (config, ...args) {
      const res = await origExtractDependencies.call(this, config, ...args);
      if (config && res) {
        config._extractedBranches = res.branches;
        config._extractedPackageFiles = res.packageFiles;
        config._extractedBranchList = res.branchList;
      }
      return res;
    };
    procMod.extractDependencies._patchedForDashboard = true;
  }

  // Patch handleError to ensure Dependency Dashboard is created/updated
  // even if an update encounters an abort (e.g. repository-changed) or error
  let errMod;
  const errCandidate = path.join(mainDir, "workers/repository/error.js");
  if (fs.existsSync(errCandidate)) {
    errMod = require(errCandidate);
  }
  if (!errMod) {
    const errKey = Object.keys(require.cache).find((k) =>
      k.includes("workers/repository/error")
    );
    if (errKey) {
      errMod = require(errKey);
    }
  }
  if (
    errMod &&
    typeof errMod.default === "function" &&
    !errMod.default._patchedForDashboard
  ) {
    const origHandleError = errMod.default;
    errMod.default = async function (config, err) {
      if (
        config &&
        config.dependencyDashboard !== false &&
        config._extractedBranches &&
        depDashboard &&
        typeof depDashboard.ensureDependencyDashboard === "function"
      ) {
        try {
          await depDashboard.ensureDependencyDashboard(
            {
              ...config,
              dependencyDashboard: true,
              repoIsOnboarded: true,
              dependencyDashboardTitle:
                config.dependencyDashboardTitle || "Renovate Dashboard 🤖",
            },
            config._extractedBranches,
            config._extractedPackageFiles || {},
            { result: "no-config" }
          );
        } catch {
          // Ignore error during fallback dashboard generation
        }
      }
      return origHandleError.call(this, config, err);
    };
    errMod.default._patchedForDashboard = true;
  }
} catch {
  // Graceful fallback if not running within Renovate execution context
}

/** @type {import('renovate').RenovateConfig} */
module.exports = {
  platform: "github",
  ignorePrAuthor: true,
  ...(gitAuthor ? { gitAuthor } : {}),
  semanticCommits: process.env.RENOVATE_SEMANTIC_COMMITS || "enabled",
  onboarding:
    process.env.RENOVATE_ONBOARDING !== undefined
      ? process.env.RENOVATE_ONBOARDING === "true"
      : false,
  onboardingConfigFileName:
    process.env.RENOVATE_ONBOARDING_CONFIG_FILE_NAME || "renovate.json",
  onboardingPrTitle:
    process.env.RENOVATE_ONBOARDING_PR_TITLE || defaultOnboardingPrTitle,
  onboardingCommitMessage:
    process.env.RENOVATE_ONBOARDING_COMMIT_MESSAGE ||
    defaultOnboardingCommitMessage,
  requireConfig: process.env.RENOVATE_REQUIRE_CONFIG || "optional",
  dependencyDashboard:
    process.env.RENOVATE_DEPENDENCY_DASHBOARD !== undefined
      ? process.env.RENOVATE_DEPENDENCY_DASHBOARD === "true"
      : true,
  dependencyDashboardTitle:
    process.env.RENOVATE_DEPENDENCY_DASHBOARD_TITLE || "Renovate Dashboard 🤖",
  globalExtends: globalExtends,
  onboardingConfig: {
    $schema: "https://docs.renovatebot.com/renovate-schema.json",
    extends: [
      "config:recommended",
      ...(defaultPreset ? [defaultPreset] : []),
    ],
  },
  // When a specific repository is requested (e.g. via workflow_dispatch),
  // target only that repository. Otherwise, autodiscover repositories
  // filtered by owner and the specified topic(s).
  ...(targetRepo
    ? {
        repositories: [targetRepo],
      }
    : {
        autodiscover: true,
        autodiscoverFilter: autodiscoverFilter,
        autodiscoverTopics: autodiscoverTopics,
      }),
  hostRules: [
    ...(process.env.RENOVATE_DOCKER_USERNAME &&
    process.env.RENOVATE_DOCKER_PASSWORD
      ? [
          {
            matchHost: "docker.io",
            username: process.env.RENOVATE_DOCKER_USERNAME,
            password: process.env.RENOVATE_DOCKER_PASSWORD,
          },
        ]
      : []),
  ],
};
