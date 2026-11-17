# Tasks: Safe Dependency Updates

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md)

## Phase 1: Setup

- [x] T001 Preserve prior work and use current upstream main as the implementation baseline.
- [x] T002 Verify the immutable image and record decisions in research.md.

## Phase 2: US1 — Safe eligible updates

- [x] T003 [US1] Add native missing-timestamp and bump-order regressions in .github/tests/renovate.test.mjs; confirm failures.
- [x] T004 [US1] Fix timestamp fallback and automerge eligibility in default.json, automerge.json, and .renovaterc.json5.

## Phase 3: US2 — Real uv cooldown

- [x] T005 [US2] Add real direct/transitive cutoff and scoped-exception tests in .github/tests/uv.test.mjs.
- [x] T006 [US2] Set the resolver child environment in .github/renovate-config.js and prove native forwarding in .github/tests/renovate.test.mjs.

## Phase 4: US3 — Reproducible execution

- [x] T007 [US3] Pin identical image digests and read-only permissions in .github/workflows/renovate.yaml and .github/workflows/validate.yaml; retain shared concurrency.
- [x] T008 [US3] Test native image extraction and synchronization in .github/tests/renovate.test.mjs.
- [x] T009 [US3] Update README.md with manual fallback, uv enforcement/exception, validation and external settings.

## Phase 5: Validation and delivery

- [x] T010 Run strict validation, native/uv/style tests, actionlint and all pre-commit hooks; record evidence in quickstart.md.
- [x] T011 Inspect current code against all requirements and report convergence.
- [x] T012 Commit and push the branch; open a PR with full-SHA spec links and live-control findings; inspect available CI evidence.

## Dependencies and Execution

Setup precedes all stories. US1 and US2 tests run before their fixes. US3 depends on image research. Native policy, uv integration, and workflow lint may run independently after edits. Implement incrementally, then converge and deliver; no additional features are in scope.
