// $schema: "https://docs.renovatebot.com/renovate-global-schema.json"

const targetRepo = process.env.RENOVATE_REPOSITORY?.trim();
const currentRepo = process.env.GITHUB_REPOSITORY;
const owner = process.env.GITHUB_REPOSITORY_OWNER || currentRepo?.split("/")[0];
const preset =
  process.env.RENOVATE_CONFIG_PRESET || (currentRepo && `github>${currentRepo}`);

module.exports = {
  platform: "github",
  onboarding: false,
  requireConfig: "optional",
  forkProcessing: "enabled",
  // Resolved with repository config so local settings and ignorePresets work.
  extends: preset ? [preset] : ["config:recommended"],
  dependencyDashboard: true,
  dependencyDashboardTitle: "Renovate Dashboard 🤖",
  ignorePrAuthor: true,
  ...(process.env.GIT_AUTHOR ? { gitAuthor: process.env.GIT_AUTHOR } : {}),
  ...(targetRepo
    ? { repositories: [targetRepo] }
    : {
        autodiscover: true,
        autodiscoverFilter: owner ? [`${owner}/*`] : ["*/*"],
        autodiscoverTopics: ["renovate"],
      }),
  hostRules:
    process.env.RENOVATE_DOCKER_USERNAME && process.env.RENOVATE_DOCKER_PASSWORD
      ? [
          {
            matchHost: "docker.io",
            username: process.env.RENOVATE_DOCKER_USERNAME,
            password: process.env.RENOVATE_DOCKER_PASSWORD,
          },
        ]
      : [],
};
