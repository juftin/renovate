# 🤖 Renovate Runner

A centralized, self-hosted [Renovate](https://docs.renovatebot.com/) runner powered by GitHub Actions. Fork this repository, install your GitHub App, and add the **`renovate` topic** to the repositories you want to manage.

**Downstream repositories do not need a Renovate config or their own workflow.** The runner supplies the shared preset, uses GitMoji for dependency PR titles and commits, and maintains a **`Renovate Dashboard 🤖`** issue in each managed repository. A downstream repository can add a config whenever it needs different settings.

## Getting started

### 1. Fork and enable Actions

Fork this repository into your account or organization. Open its **Actions** tab and enable workflows. Repository names and discovery filters are derived from the fork's owner and repository name.

### 2. Configure authentication

A GitHub App is recommended. It provides a bot identity and allows PRs created by Renovate to trigger downstream GitHub Actions workflows.

#### GitHub App permissions

In the app's **Permissions & events** settings, configure these exact **Repository permissions**. This list follows [Renovate's GitHub App requirements](https://docs.renovatebot.com/modules/platform/github/#running-as-a-github-app).

| Repository permission | Required access | Used for |
|---|---|---|
| Administration | **Read-only** | Inspect repository settings and protection rules |
| Checks | **Read and write** | Read and manage checks |
| Commit statuses | **Read and write** | Read CI status and publish Renovate status checks |
| Contents | **Read and write** | Read files and push update branches |
| Dependabot alerts | **Read-only** | Read vulnerability alerts |
| Issues | **Read and write** | Create and update `Renovate Dashboard 🤖` issues |
| Metadata | **Read-only** (automatically granted) | Access repository metadata |
| Pull requests | **Read and write** | Create, update, and merge PRs |
| Workflows | **Read and write** | Update files in `.github/workflows/` |

Add these permissions only when the condition applies:

| Permission section | Permission | Access | When needed |
|---|---|---|---|
| Organization permissions | Members | **Read-only** | Installing the app on an organization; not needed for a personal account |
| Repository permissions | Merge queues | **Read and write** | Managing repositories that use GitHub merge queues |

Leave all other permissions at **No access**, including **Account permissions**. The app installation must include every repository you want to manage, including this runner. Issues must also be enabled in those repositories for dashboards to be created.

#### Create and install the app

1. Open **[Settings → Developer settings → GitHub Apps → New GitHub App](https://github.com/settings/apps/new)**. For an organization, use its GitHub App settings instead.
2. Choose a name and use your runner repository URL as the homepage URL. Disable the webhook; this runner uses a schedule.
3. Set the [GitHub App permissions](#github-app-permissions) listed above.
4. Create the app, note its **App ID**, and generate a private key from its **General** settings.
5. Install the app on your account or organization. Grant access to all repositories you want the runner to manage, including the runner repository and any private preset repository. Selecting **All repositories** allows newly tagged repositories to be discovered automatically.
6. In the runner repository's **Settings → Secrets and variables → Actions**, add:

   | Secret | Value |
   |---|---|
   | `APP_ID` | The app's numeric ID |
   | `APP_PRIVATE_KEY` | The complete contents of the downloaded private key file |

   `RENOVATE_APP_ID` and `RENOVATE_APP_PRIVATE_KEY` are also accepted.

#### Update an existing app's permissions

1. Open **Settings → Developer settings → GitHub Apps → your app → Permissions & events**.
2. Apply the [exact permission settings above](#github-app-permissions) and **Save changes**.
3. Open **Settings → Applications → Installed GitHub Apps** (or the organization's installed app settings), find the app, and approve its pending **Review request**. **Saving the app registration alone does not grant new permissions to an existing installation.** See [GitHub's permission update instructions](https://docs.github.com/en/apps/maintaining-github-apps/modifying-a-github-app-registration#changing-the-permissions-of-a-github-app).
4. Rerun the Renovate workflow. It generates a fresh installation token with the approved permissions. Keep the existing `APP_ID` and `APP_PRIVATE_KEY`; neither needs to be replaced for a permission change.

#### PAT alternative

Alternatively, provide a dedicated account's PAT as `RENOVATE_TOKEN` or `APP_TOKEN`. A classic PAT needs `repo` and `workflow` scopes; a fine-grained PAT needs the applicable repository permissions above. PAT-created PRs can trigger Actions when the token has the required access. The workflow's built-in `github.token` fallback is scoped to the runner repository and is unsuitable for managing downstream repositories.

### 3. Tag target repositories

Add the **`renovate` topic** under each repository's **About → Settings → Topics**. This is a repository topic, not an issue or PR label.

```bash
gh repo edit <owner>/<target-repo> --add-topic renovate
```

Tag the runner repository too if you want it to manage its own dependencies. Ensure GitHub Issues is enabled on every repository that should receive a dashboard.

### 4. Verify and run

In the runner's **Actions → renovate → Run workflow**, select `dry_run: full`. Check the logs for discovered repositories, GitMoji update titles, and `Would ensure Dependency Dashboard`.

Or use the GitHub CLI:

```bash
gh workflow run renovate.yaml --repo <owner>/<runner-repo> -f dry_run=full
gh run watch --repo <owner>/<runner-repo>
```

A dry run does not create dashboards or update PRs. Once it succeeds, run again with `dry_run: null` or wait for the scheduled run, every 30 minutes.

## How configuration works

The runner uses Renovate's supported configuration options:

- `onboarding: false` skips onboarding PRs.
- `requireConfig: "optional"` processes repositories with or without a local config.
- `forkProcessing: "enabled"` includes forks that have opted in through the topic.
- `extends` supplies the shared preset when Renovate resolves each repository's configuration.
- `dependencyDashboard: true` enables dashboards with the title `Renovate Dashboard 🤖`.

Without a local config, a tagged repository gets the shared defaults automatically. If `renovate.json`, `.renovaterc.json5`, or another supported config exists, Renovate reads it and applies its overrides. There is no need to repeat the runner's shared preset in that file.

These are **defaults**, so downstream repositories can opt out of GitMoji, disable their dashboard, or change package rules. Package rules merge; later matching rules override earlier values. See [Renovate's config precedence](https://docs.renovatebot.com/config-overview/) and [package rules](https://docs.renovatebot.com/configuration-options/#packagerules).

The runner uses `extends` instead of `globalExtends`, allowing downstream repositories to use `ignorePresets` to exclude the shared preset. For a private preset, the app must have access to its repository. See [Renovate's preset loading options](https://docs.renovatebot.com/self-hosted-configuration/#globalextends).

There are no patches to Renovate internals, Git operations, status checks, or JSON formatting. Permission errors and rejected pushes are reported normally. An aborted run may leave a dashboard uncreated or stale until a later successful run; inspect the logs and correct the underlying error. Retain PR-based automerge so branch protection is respected.

Existing PR titles, old onboarding PRs, and dashboards with different titles are no longer rewritten by custom code. If an old `Dependency Dashboard` issue exists, rename it to `Renovate Dashboard 🤖` before the next run, or configure the runner to use the old title.

## Shared presets

| Preset | Reference | Behavior |
|---|---|---|
| Default | `github><owner>/<repo>` | GitMoji, dashboard, labels and scopes, GitHub Actions digest pinning, Docker major updates, annotated dependency and OCI regex managers |
| GitMoji | `github><owner>/<repo>:gitmoji` | Commit style rules: 💥 major, ✨ minor, 🐛 patch, 📌 pins/digests, 👷 GitHub Actions, 🔒 lockfiles |
| Conventional | `github><owner>/<repo>:conventional` | Conventional commit style rules: `feat`, `fix`, `chore`, and `ci` |
| Automerge | `github><owner>/<repo>:automerge` | PR automerge for selected GitHub Actions, pre-commit, and Mise updates after three days, with passing checks |

The default preset currently includes the GitMoji rules directly. When changing its commit rules, update both `default.json` and the standalone `gitmoji.json`. The runner repository inherits this same default preset through the runner; its `.renovaterc.json5` only adds PR automerge for selected updates. `automerge.json` is opt-in for other repositories.

Repositories managed by another Renovate instance can also use these presets explicitly:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github><owner>/<repo>"]
}
```

## Customizing settings

### Across all managed repositories

Edit `default.json` to change the defaults, including dashboard settings, managers, labels, or package rules. Changes apply on the next run. The runner also supplies the dashboard title, so change it in `.github/renovate-config.js` if adopting a different title throughout.

To load multiple presets, set the runner repository's **Actions variable** `RENOVATE_EXTENDS` to a JSON array. For example, to retain the base behavior while using Conventional Commits:

```json
["github><owner>/<repo>", "github><owner>/<repo>:conventional"]
```

Add `github><owner>/<repo>:automerge` to enable its rules across managed repositories. Changes to shared presets affect every repository using them unless overridden locally.

### In one downstream repository

Add a `renovate.json` only when you need an exception. To use Conventional Commits while retaining the runner's other defaults:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github><owner>/<repo>:conventional"]
}
```

Other examples:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "dependencyDashboard": false,
  "packageRules": [
    {
      "matchPackageNames": ["pytest"],
      "semanticCommitType": "🧪 ",
      "semanticCommitScope": "tests"
    }
  ]
}
```

Use `"semanticCommits": "disabled"` to disable semantic prefixes, or `"enabled": false` to disable Renovate for that repository. To exclude the runner's shared preset entirely:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "ignorePresets": ["github><owner>/<repo>"],
  "extends": ["config:recommended", "github><owner>/<repo>:conventional"]
}
```

The runner's dashboard default still applies unless overridden with `dependencyDashboard: false`.

## Runner variables and secrets

Configure **Actions variables** in the runner repository:

| Variable | Default | Purpose |
|---|---|---|
| `RENOVATE_AUTODISCOVER_FILTER` | `["<owner>/*"]` | Filter repositories by name; use a JSON array of patterns |
| `RENOVATE_AUTODISCOVER_TOPICS` | `["renovate"]` | Discover repositories matching these topics; use a JSON array |
| `RENOVATE_CONFIG_PRESET` | `github><owner>/<runner-repo>` | Single shared preset; retained for existing installations |
| `RENOVATE_EXTENDS` | The preset above as a JSON array | Override the full list of shared presets, in order |

Renovate parses these native array settings. The workflow explicitly forwards the variables above; arbitrary GitHub Actions variables are not automatically environment variables. Other settings belong in the shared presets or the runner config. The previous `RENOVATE_GLOBAL_EXTENDS`, onboarding-title, and onboarding-formatting customization code has been removed. Migrate shared preset lists to `RENOVATE_EXTENDS`.

Optional **Actions secrets**:

| Secret | Purpose |
|---|---|
| `APP_TOKEN` / `RENOVATE_TOKEN` | PAT or externally managed installation token instead of app credentials |
| `DOCKER_USERNAME` / `DOCKER_TOKEN` | Docker Hub credentials to reduce registry rate limits |

## Workflows and validation

The `renovate` workflow runs every 30 minutes, on relevant pushes to `main`, or manually. Runs are serialized so a targeted run cannot modify a repository concurrently with autodiscovery.

| Manual input | Default | Purpose |
|---|---|---|
| `repository` | Empty | Target one `owner/repo`; bypass topic discovery |
| `dry_run` | `null` | `null`, `extract`, `lookup`, or `full` |
| `log_level` | `info` | `trace`, `debug`, `info`, `warn`, or `error` |
| `repo_cache` | `enabled` | `enabled`, `disabled`, or `reset` |

CI runs `actionlint` and strict Renovate configuration validation. The validator uses the same pinned Renovate version as the runner on Node 24. Keep both version annotations aligned when upgrading Renovate. Schema validation alone does not prove app permissions or dashboard writes; verify those with the full dry run and a subsequent live run.

Repository layout:

```text
.github/renovate-config.js       Native runner configuration
.github/workflows/renovate.yaml  Scheduled and manual runs
.github/workflows/validate.yaml  Config and workflow validation
default.json                    Shared defaults, including GitMoji
gitmoji.json                    Standalone GitMoji preset
conventional.json               Standalone Conventional Commits preset
automerge.json                  Opt-in PR automerge rules
.renovaterc.json5                Runner repository's own update settings
```

## License

[MIT](LICENSE).
