# Policy Data

An update carries a manager, datasource, updateType, optional isBump, and optional releaseTimestamp. Timestamped ordinary releases are eligible after seven days; selected non-bump automerge releases after fourteen. Missing timestamps, bumps, pins, recovery and security updates require manual review.

The runner supplies a global seven-day uv cutoff. A package-specific exception exempts only that package. The fixture index contains two synthetic packages with old and fresh versions and wheel metadata; it does not use real package names or private data.
