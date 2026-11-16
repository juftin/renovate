# Feature Specification: Safe Dependency Updates

**Feature Branch**: `harden-dependency-updates`
**Created**: 2026-11-16
**Status**: Approved for implementation
**Input**: Implement the dependency-security review findings and open a PR against current upstream main.

## User Scenarios & Testing

### User Story 1 — Updates progress safely (P1)

Maintainers receive eligible dependency updates without indefinite stalls or accidental unattended merging.

**Independent Test**: Resolve the actual presets with the pinned Renovate version and exercise timestamped, missing-timestamp, bump, recovery, and security updates.

**Acceptance Scenarios**:

1. A timestamped ordinary release waits seven days; selected automerge updates wait fourteen days.
2. Missing-timestamp sources remain eligible for manually reviewed updates without being silently automerged.
3. Bumps and recovery updates retain manual review regardless of base/automerge preset ordering.
4. Vulnerability fixes bypass release-age delays and require manual review.

### User Story 2 — Lockfile resolutions respect a cooldown (P1)

The centralized runner applies a seven-day cutoff to uv's direct and transitive resolutions, even without downstream configuration.

**Independent Test**: Run real uv lock operations against a synthetic package index containing older and newly released direct/transitive versions.

**Acceptance Scenarios**:

1. Regular and maintenance resolutions exclude fresh direct and transitive releases.
2. A reviewed package-specific exception permits a fresh security fix without exempting other packages.
3. Resolver settings reach actual Renovate subprocesses.

### User Story 3 — Execution is reproducible and reviewable (P2)

Maintainers run and validate the same immutable Renovate image and can assess deployment prerequisites.

**Independent Test**: Validate workflows and image extraction; run tests and config validation in the pinned image in CI.

**Acceptance Scenarios**:

1. Runtime and validation reference the same digest-pinned image and update together.
2. Scheduled and targeted runs share one concurrency group.
3. Workflow tokens default to read-only, and checkouts do not persist credentials.
4. The PR documents the observed branch protection and any inaccessible permission/alert checks.

### Edge Cases

- Registries without upload timestamps need a reviewed package/index exception.
- Changing a mutable image tag does not change pinned execution bytes.
- Existing repository overrides remain supported; shared presets provide defaults, not an unoverrideable organization policy.
- The local environment may lack Docker; CI must provide image execution evidence and limitations must remain explicit.

## Requirements

### Functional Requirements

- **FR-001**: Preserve current upstream commit-style, discovery, native runner behavior, and `config:recommended` base.
- **FR-002**: Apply seven/fourteen-day release-age rules only where usable; sources without timestamps must have a manual-review path.
- **FR-003**: Prevent the shipped automerge rules from overriding bump/recovery manual-review exceptions.
- **FR-004**: Enforce a seven-day uv resolver cutoff centrally, including transitive dependencies during lockfile maintenance, with a package-specific emergency path.
- **FR-005**: Pin the runner and validation environment to the same immutable image; avoid npm installation during CI validation.
- **FR-006**: Serialize scheduled/targeted runner executions and retain least-privilege workflow credentials.
- **FR-007**: Add meaningful native-policy and real uv regression tests; retain existing commit-style checks.
- **FR-008**: Document operational exceptions and report live repository security checks accurately in the PR.

## Success Criteria

- **SC-001**: Timestamped, missing-timestamp, security, bump, recovery, and automerge regression scenarios pass.
- **SC-002**: Real lockfile operations exclude fresh direct/transitive versions and permit only the specifically exempted package.
- **SC-003**: Strict configuration validation, workflow lint, formatting/hooks, and regression tests pass; remote CI evidence is recorded.
- **SC-004**: A PR targets current upstream main with a clear summary, verification, spec permalinks, and remaining rollout prerequisites.

## Assumptions

- The existing uncommitted work is part of this request; changes already present upstream are preserved rather than reapplied.
- The default-branch protection and installed App configuration are external controls: inspect where authorized and document gaps; this PR does not silently change account-wide security policy.
- No release or default branch is pushed directly; PR creation is authorized.
