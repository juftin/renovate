// $schema: "https://docs.renovatebot.com/renovate-schema.json"

const gitAuthor = process.env.GIT_AUTHOR;

const targetRepo =
  process.env.RENOVATE_REPOSITORY &&
  process.env.RENOVATE_REPOSITORY.trim() !== ""
    ? process.env.RENOVATE_REPOSITORY.trim()
    : null;

const defaultOwner = process.env.GITHUB_REPOSITORY_OWNER || "juftin";

let autodiscoverFilter = [`${defaultOwner}/*`];
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

/** @type {import('renovate').RenovateConfig} */
module.exports = {
  platform: "github",
  ...(gitAuthor ? { gitAuthor } : {}),
  onboarding:
    process.env.RENOVATE_ONBOARDING !== undefined
      ? process.env.RENOVATE_ONBOARDING === "true"
      : true,
  onboardingPrTitle: "👷 configure renovate",
  onboardingCommitMessage: "👷 configure renovate",
  requireConfig: process.env.RENOVATE_REQUIRE_CONFIG || "optional",
  onboardingConfig: {
    extends: ["config:recommended", "github>juftin/renovate"],
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
