# NOTES

No open blockers.

The CE-013 bundle finding is resolved as a policy change rather than a code change. The full-library
minified and gzipped figures move in opposite directions under deduplication, so treating the
gzipped number as a hard constant selected against consolidating duplicated code. The two figures
now have separate roles — see REQUIREMENTS.md § Bundle Size and the Key Decisions row in
ARCHITECTURE.md:

- **Core, ≤ 4096 B gzipped** — a hard promise, never relaxed. Tree-shaking means this is what a
  typical consumer actually ships.
- **Full library, ≤ 32768 B / ≤ 10240 B** — a working diagnostic against accidental blowup,
  re-baselined from measurement at release by **CE-015**, and explicitly not defended during a
  refactor.
