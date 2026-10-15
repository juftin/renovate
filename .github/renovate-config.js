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
    for (const [, platformApi] of api.default.entries()) {
      if (platformApi && !platformApi._patchedForGitmoji) {
        if (typeof platformApi.createPr === "function") {
          const origCreatePr = platformApi.createPr;
          platformApi.createPr = function (options) {
            if (options && options.prTitle && options.prTitle.startsWith("chore: 👷")) {
              options.prTitle = options.prTitle.replace(/^chore:\s*/, "");
            }
            return origCreatePr.call(this, options);
          };
        }
        if (typeof platformApi.updatePr === "function") {
          const origUpdatePr = platformApi.updatePr;
          platformApi.updatePr = function (options) {
            if (options && options.prTitle && options.prTitle.startsWith("chore: 👷")) {
              options.prTitle = options.prTitle.replace(/^chore:\s*/, "");
            }
            return origUpdatePr.call(this, options);
          };
        }
        if (typeof platformApi.getBranchPr === "function") {
          const origGetBranchPr = platformApi.getBranchPr;
          platformApi.getBranchPr = async function (branchName, ...args) {
            const pr = await origGetBranchPr.call(this, branchName, ...args);
            if (pr && pr.title && pr.title.startsWith("chore: 👷")) {
              if (pr.bodyStruct) {
                pr.bodyStruct.hash = null;
              }
              pr.title = pr.title.replace(/^chore:\s*/, "");
            }
            return pr;
          };
        }
        platformApi._patchedForGitmoji = true;
      }
    }
  }
} catch {
  // Graceful fallback if not running within Renovate execution context
}

/** @type {import('renovate').RenovateConfig} */
module.exports = {
  platform: "github",
  ...(gitAuthor ? { gitAuthor } : {}),
  onboarding:
    process.env.RENOVATE_ONBOARDING !== undefined
      ? process.env.RENOVATE_ONBOARDING === "true"
      : true,
  onboardingConfigFileName:
    process.env.RENOVATE_ONBOARDING_CONFIG_FILE_NAME || "renovate.json",
  onboardingPrTitle:
    process.env.RENOVATE_ONBOARDING_PR_TITLE || defaultOnboardingPrTitle,
  onboardingCommitMessage:
    process.env.RENOVATE_ONBOARDING_COMMIT_MESSAGE ||
    defaultOnboardingCommitMessage,
  requireConfig: process.env.RENOVATE_REQUIRE_CONFIG || "optional",
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
