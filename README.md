# Renovate Runner

Run [Renovate](https://docs.renovatebot.com/) on GitHub Actions for repositories with the **`renovate-enabled` topic**. Fork this repository, configure authentication, and tag the repositories you want to manage.

Managed repositories get dependency PRs and a **Renovate Dashboard 🤖** issue without needing their own workflow or Renovate config. **Conventional Commits are the default**; GitMoji is an optional override.

## Get started

1. **Fork and enable Actions.** Open the fork's **Actions** tab and enable workflows. The runner detects its owner and repository name automatically.
2. **Configure a GitHub App.** [Create an app](https://github.com/settings/apps/new), disable its webhook, and install it on the repositories you want to manage, including the runner. Add `APP_ID` and `APP_PRIVATE_KEY` as repository secrets under **Settings → Secrets and variables → Actions**.
3. **Tag your repositories.** Add the `renovate-enabled` topic in each repository's **About → Settings**. Enable Issues for dashboards. Tag the runner too if it should update itself.
4. **Verify and run.** Open **Actions → renovate → Run workflow**, choose `dry_run: full`, and check the logs for discovered repositories. Then run with `dry_run: null` to create updates and dashboards. Scheduled runs happen every 30 minutes.

<details>
<summary>GitHub App setup and permissions</summary>

Use the runner's repository URL as the app's homepage. After creating the app, copy its numeric **App ID** and generate a private key from **General → Private keys**. The `APP_PRIVATE_KEY` secret must contain the complete downloaded `.pem` file.

Configure these repository permissions, following [Renovate's requirements](https://docs.renovatebot.com/modules/platform/github/#running-as-a-github-app):

| Permission | Access |
|---|---|
| Contents, Pull requests, Issues, Workflows, Commit statuses, Checks | Read and write |
| Administration, Dependabot alerts, Metadata | Read-only |

For organization installations, also grant **Organization permissions → Members: Read-only**. Add **Merge queues: Read and write** when managing repositories that use merge queues.

Install the app on all repositories you want to manage. Choosing **All repositories** allows newly tagged repositories to be discovered without updating the installation. The app must also have access to private preset repositories.

When updating an existing app's permissions, save the changes and approve the pending permission request in the account or organization's **Installed GitHub Apps** settings. Rerun the workflow to generate a fresh token; the existing app ID and private key can stay the same.

`RENOVATE_APP_ID` and `RENOVATE_APP_PRIVATE_KEY` are accepted aliases for the app secrets.

</details>

<details>
<summary>Use a personal access token instead</summary>

Set the `RENOVATE_TOKEN` or `APP_TOKEN` repository secret. A classic PAT needs `repo` and `workflow` scopes; a fine-grained PAT needs the applicable [Renovate permissions](https://docs.renovatebot.com/modules/platform/github/#running-using-a-fine-grained-token).

The token must have access to all managed repositories. The built-in `github.token` fallback only has access to the runner repository.

</details>

<details>
<summary>Set up and run with the GitHub CLI</summary>

```bash
gh secret set APP_ID --repo <owner>/<runner-repo>
gh secret set APP_PRIVATE_KEY --repo <owner>/<runner-repo> < private-key.pem
gh repo edit <owner>/<target-repo> --add-topic renovate-enabled
gh workflow run renovate.yaml --repo <owner>/<runner-repo> -f dry_run=full
gh run watch --repo <owner>/<runner-repo>
```

A dry run does not create PRs or dashboards. Run again without `-f dry_run=full` to apply updates.

</details>

## Commit style

The shared default preset and runner use Conventional Commits (`feat`, `fix`, `chore`, and `ci`). Forks inherit this behavior without configuration.

To use **GitMoji** throughout this runner and its managed repositories, set the runner's **Actions variable** under **Settings → Secrets and variables → Actions → Variables**:

```text
RENOVATE_COMMIT_STYLE = gitmoji
```

Set this variable before deploying the change to an existing GitMoji installation. To switch back, delete the variable or set it to `conventional`.

The style preset is applied after the base preset, preserving its managers, labels, and dashboard settings. A repository's own commit rules can override these defaults.

## Shared presets

| Preset | Reference | Includes |
|---|---|---|
| [Default](default.json) | `github><owner>/<repo>` | Conventional Commits, 7-day cool-down period with strict checks, weekly lockfile maintenance, dashboard, labels and scopes, Docker major updates, GitHub Actions digest pinning, annotated dependencies and OCI images |
| [GitMoji](gitmoji.json) | `github><owner>/<repo>:gitmoji` | Commit style rules: 💥 major, ✨ minor, 🐛 patch, 📌 pins/digests, 👷 Actions, 🔒 lockfiles |
| [Conventional](conventional.json) | `github><owner>/<repo>:conventional` | Commit style rules: `feat`, `fix`, `chore`, `ci` |
| [Automerge](automerge.json) | `github><owner>/<repo>:automerge` | PR automerge for selected Actions, pre-commit, and Mise updates after 14 days with passing checks |

Edit the preset files to customize shared settings. The runner applies them automatically; automerge is opt-in for downstream repositories. The runner's own [config](.renovaterc.json5) adds automerge for selected Actions and pre-commit updates and inherits the selected commit style.

<details>
<summary>Dependency cool-down and lockfile guidance</summary>

The default preset enforces a **7-day cool-down period** (`minimumReleaseAge: "7 days"`) with strict release-age checks (`internalChecksFilter: "strict"`) and required release timestamps (`minimumReleaseAgeBehaviour: "timestamp-required"`). During this window, updates remain pending and visible under the Dependency Dashboard before PRs are created.

Automerging requires a **14-day cool-down** (`minimumReleaseAge: "14 days"`). Security and vulnerability fixes are exempt from cool-downs (`minimumReleaseAge: null`, `automerge: false`) for immediate manual review.

### uv and lockfiles

Renovate's native `pep621` manager handles `pyproject.toml` and existing `uv.lock` files together. Weekly lockfile maintenance runs before 04:00 UTC on Mondays without release-age gates. Downstream projects using uv can configure matching client-side cutoffs in `pyproject.toml`:

```toml
[tool.uv]
exclude-newer = "7 days"
```

</details>

<details>
<summary>Use presets with another Renovate instance</summary>

Add this to a repository's `renovate.json`, replacing `<owner>/<repo>` with the preset host:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github><owner>/<repo>"]
}
```

For GitMoji or automerge, append `github><owner>/<repo>:gitmoji` or `github><owner>/<repo>:automerge` after the default preset. The style presets contain commit rules only.

</details>

<details>
<summary>Override settings in one managed repository</summary>

Add a `renovate.json` only when you need an exception. For example, to use Conventional Commits under a GitMoji runner:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github><owner>/<runner-repo>:conventional"]
}
```

Use `:gitmoji` for the reverse. Other useful overrides:

- `"dependencyDashboard": false` disables the dashboard.
- `"semanticCommits": "disabled"` removes semantic prefixes.
- `"enabled": false` disables Renovate for that repository.
- `packageRules` can customize commit types, scopes, schedules, and automerge.

Repository config takes precedence over runner defaults; later matching package rules override earlier values. See [Renovate's configuration precedence](https://docs.renovatebot.com/config-overview/#config-precedence).

</details>

<details>
<summary>Advanced runner settings</summary>

These **Actions variables** are forwarded by the [workflow](.github/workflows/renovate.yaml):

| Variable | Default | Purpose |
|---|---|---|
| `RENOVATE_COMMIT_STYLE` | `conventional` | `conventional` or `gitmoji` |
| `RENOVATE_AUTODISCOVER_FILTER` | `["<owner>/*"]` | Repository name pattern or JSON array of patterns |
| `RENOVATE_CONFIG_PRESET` | `github><owner>/<runner-repo>` | Base preset; the selected style is appended |
| `RENOVATE_AUTODISCOVER_TOPICS` | `["renovate-enabled"]` | Discover repositories matching these topics; JSON array |
| `RENOVATE_EXTENDS` | Base and selected style presets | Override the full preset list; JSON array in precedence order |

For compatibility, a `RENOVATE_CONFIG_PRESET` ending in `:gitmoji` selects GitMoji when `RENOVATE_COMMIT_STYLE` is unset. Prefer the style variable with the default base preset to retain all shared settings.

To use multiple presets across managed repositories, set `RENOVATE_EXTENDS` to a JSON array. This replaces the computed base and style list, so include both explicitly:

```json
["github><owner>/<runner-repo>", "github><owner>/<runner-repo>:gitmoji", "github><owner>/<runner-repo>:automerge"]
```

The runner uses native Renovate configuration: `onboarding: false`, `requireConfig: "optional"`, and `forkProcessing: "enabled"`. Presets are resolved with repository config through `extends`, allowing local overrides and `ignorePresets`. Other runner defaults belong in the [runner config](.github/renovate-config.js). Migrate older `RENOVATE_GLOBAL_EXTENDS` settings to `RENOVATE_EXTENDS`; custom onboarding-title and JSON-formatting patches are no longer used.

Arbitrary Actions variables are not automatically passed to Renovate. Add an `env` entry in the workflow when exposing another setting.

Optional **Actions secrets** `DOCKER_USERNAME` and `DOCKER_TOKEN` supply Docker Hub credentials.

</details>

<details>
<summary>Manual runs and validation</summary>

The workflow runs every 30 minutes, on relevant pushes to `main`, or manually:

| Manual input | Default | Options |
|---|---|---|
| `repository` | Empty (topic discovery) | One `owner/repo` |
| `dry_run` | `null` | `null`, `extract`, `lookup`, `full` |
| `log_level` | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `repo_cache` | `enabled` | `enabled`, `disabled`, `reset` |

CI validates Renovate configuration, checks commit-style behavior, and runs `actionlint`. Local commit-style checks:

```bash
node --test .github/renovate-config.test.cjs
```

A successful config check does not verify app permissions. Use a dry run and then a live run to verify discovery, PRs, and dashboards.

</details>

[MIT License](LICENSE).
