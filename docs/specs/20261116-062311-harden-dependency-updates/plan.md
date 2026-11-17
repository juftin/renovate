# Implementation Plan: Safe Dependency Updates

**Branch**: `harden-dependency-updates` | **Date**: 2026-11-16 | **Spec**: [spec.md](spec.md)

## Summary

Build on current upstream main. Allow missing-timestamp updates for manual review; restrict every shipped automerge rule to timestamped, non-bump updates. Forward uv's seven-day resolver cutoff centrally. Run validation and tests in the same digest-pinned full Renovate image used by the runner.

## Technical Context

- Language: existing CommonJS runner config, JSON presets, YAML workflows; Node 24 tests.
- Dependencies: Renovate 44.164.6 full image; bundled uv 0.13.1 and Python 3.14.8.
- Storage: none; synthetic integration fixtures live in a temporary directory.
- Testing: Node test runner, actual Renovate policy merge/filter APIs, actual uv lock against a local synthetic index, actionlint and existing pre-commit hooks.
- Platform: GitHub-hosted Linux Actions; local fallback uses the exact installed Renovate release because Docker is unavailable.
- Constraints: preserve current Conventional Commits/default discovery behavior; no secrets in fixtures or logs; no npm downloads during CI validation.
- Scope: default/automerge/self presets, runner child environment, two workflows, README, existing and new regression tests.

## Constitution Check

No project constitution exists. User principles govern: surgical changes, minimum abstractions, behavior-based tests, documentation, no secret-file reads. Passed before and after design. No new application framework, task runner, or package-management scaffold is needed.

## Project Structure

- `.github/renovate-config.js`: uv child environment only; retain native upstream runner.
- `default.json`, `automerge.json`, `.renovaterc.json5`: release policy changes.
- `.github/workflows/{renovate,validate}.yaml`: same image digest, read-only default permissions; preserve upstream shared concurrency group.
- `.github/tests/renovate.test.mjs`: actual native policy and image extraction tests.
- `.github/tests/uv.test.mjs`: real uv resolutions against a local synthetic index.
- `.github/renovate-config.test.cjs`: retain and extend runner regression coverage.
- `README.md`: exceptions, reproducible validation, and operational prerequisites.

## Decisions

1. Use `timestamp-optional` for ordinary updates and require a release timestamp in each automerge matcher. Missing dates permit manual work but never opt into shipped automerge rules.
2. Match automerge only when `isBump` is not true, making exceptions independent of shipped preset ordering.
3. Use `customEnvVariables.UV_EXCLUDE_NEWER = "7 days"`; package-specific uv exceptions permit reviewed urgent fixes.
4. Use `ghcr.io/renovatebot/renovate:44.164.6-full@sha256:de0a2f27db5323570c14eee2fa613f3d9e01156c0d4888daa6af665de0634b5e` in runner and validation. Native github-actions extraction updates both references.
5. Use Node built-ins for a synthetic PEP 691/658 index; test fresh direct and transitive releases and package-specific overrides without real external packages.
6. Inspect live repository safety read-only. Existing branch protection is absent; report this and unavailable App/alert permissions in the PR rather than changing repository governance silently.

## Complexity Tracking

No exceptions to the governing principles. Test fixtures are limited to dependency-policy behavior that has already produced bugs.
