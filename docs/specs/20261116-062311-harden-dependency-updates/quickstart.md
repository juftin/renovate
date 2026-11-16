# Validation

Run the commands in `.github/workflows/validate.yaml` in its pinned image: strict Renovate config validation followed by both Node test suites. The native-policy tests require that image or the same Renovate installation on PATH; uv tests require bundled uv.

For local fallback, expose the installed matching Renovate binaries on PATH, use Node24 and uv0.13.1, then run `node --test .github/renovate-config.test.cjs .github/tests/*.test.mjs`. Run actionlint and `pre-commit run --all-files` before committing.

Expected: timestamped updates wait for eligibility; missing-date and bump updates remain manual; fresh direct/transitive fixture versions are excluded; a package-specific exception releases only that package. CI verifies identical runner/validator digests and native image extraction. Live GitHub settings are reported separately in the PR.

## Verification evidence

On 2026-11-16, local Node24 and Renovate44.164.6 passed all fourteen tests, including real uv0.13.1 lock operations. Strict validation passed for all six config files; actionlint passed both workflows. The container registry confirmed the multi-platform image digest. Local Docker execution is unavailable; the PR's container job is the authoritative same-image check.

Live repository inspection: upstream `main` reports `protected: false` and the ruleset collection is empty. The connected integration returns HTTP403 for detailed branch-protection access. Installed App permissions and Dependabot alert access cannot be established with this connection; confirm them during rollout.

GitHub Actions [run 43817950956](https://github.com/juftin/renovate/actions/runs/43817950956) passed strict validation and all fourteen tests inside the pinned image, plus actionlint, for implementation commit `f66e66ca32cc50cbab55f05f893da03c580f56d7`. The targeted full dry run could not be dispatched on the fork because `renovate.yaml` is unavailable as a workflow on its default branch (HTTP404); authentication/alert checks remain rollout prerequisites.
