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
  onboardingPrTitle: "👷 configure renovate",
  onboardingCommitMessage: "👷 configure renovate",
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
