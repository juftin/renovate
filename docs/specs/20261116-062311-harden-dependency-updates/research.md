# Research

- Decision: native policy matchers can check releaseTimestamp and isBump. Rationale: the pinned Renovate filter merges candidate release metadata before applying package rules; a bump can also be typed patch, so matchUpdateTypes alone is insufficient. Alternative: final exception rules depend on ordering and are less robust.
- Decision: missing timestamps use manual review. Rationale: Docker release dates are available only from Docker Hub; python-version has no release dates. Alternative: globally required timestamps permanently stall those sources.
- Decision: central customEnvVariables passes UV_EXCLUDE_NEWER to subprocesses. Rationale: verified native child environment merging. A plain workflow UV_* variable is not forwarded by the action default filter. Package-specific cutoffs override the global uv cutoff.
- Decision: pin the full image by multi-platform index digest. Rationale: registry and image metadata verify Renovate44.164.6, uv0.13.1, Node24.22.0 and Python3.14.8; native action parsing supports full image references. Alternative: npm validation resolves fresh transitive versions.
- Verification constraint: local Docker client has no daemon or usable rootless runtime. Same-image execution is performed by GitHub Actions; local checks use installed matching tools and do not claim container execution.

Sources: [Renovate Docker datasource](https://docs.renovatebot.com/modules/datasource/docker/), [Python versions](https://docs.renovatebot.com/modules/datasource/python-version/), [action image input](https://github.com/renovatebot/github-action#renovate-image), [uv cutoff semantics](https://docs.astral.sh/uv/concepts/resolution/).
