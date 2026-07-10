# PLAN: CI Workflow + Test Gate on Publish

## Goal

The repository has **no CI**. The only workflow (`.github/workflows/npm-publish.yml`) publishes to npm on GitHub release **without running a single test** — a release cut from a broken branch ships broken code with provenance attached. Add a CI workflow that runs typecheck, lint, tests, bundle-size regression, and build on every push/PR, and make the publish workflow run the same gate before publishing.

All commands below were verified to pass locally on `next` (2026-07-10):

- `bunx tsc --noEmit` → exit 0
- `bunx biome lint .` → "Checked 49 files… No fixes applied." (exit 0)
- `bun test --path-ignore-patterns='**/regression*'` (what `bun run test` does) → 561 pass
- `bun test test/regression-bundle.test.ts` → 3 pass

**Important pitfalls already checked:** `bun run lint` is `biome lint --write` (mutating — never use in CI), and `bunx biome ci .` FAILS on this repo (46 formatting errors — the repo is lint-clean but not biome-*format*-clean). CI must use `bunx biome lint .`, not `biome ci` and not `biome check`.

## Files to touch

- `.github/workflows/ci.yml` — new file
- `.github/workflows/npm-publish.yml` — add test gate before publish
- `package.json` — add a `check` convenience script (optional, step 3)

## Implementation steps

1. **Create `.github/workflows/ci.yml`:**

   ```yaml
   name: CI

   on:
       push:
           branches: [main, next]
       pull_request:
           branches: [main, next]

   jobs:
       test:
           runs-on: ubuntu-latest
           steps:
               - name: Checkout repository
                 uses: actions/checkout@v4

               - name: Setup Bun
                 uses: oven-sh/setup-bun@v1
                 with:
                     bun-version: latest

               - name: Install dependencies
                 run: bun install --frozen-lockfile

               - name: Typecheck
                 run: bunx tsc --noEmit

               - name: Lint
                 run: bunx biome lint .

               - name: Unit tests
                 run: bun run test

               - name: Bundle size regression
                 run: bun test test/regression-bundle.test.ts

               - name: Build
                 run: bun run build

       performance:
           runs-on: ubuntu-latest
           continue-on-error: true
           steps:
               - uses: actions/checkout@v4
               - uses: oven-sh/setup-bun@v1
                 with:
                     bun-version: latest
               - run: bun install --frozen-lockfile
               - name: Performance regression (informational — shared runners are noisy)
                 run: bun test test/regression-performance.test.ts
   ```

   Match the existing workflow's indentation style (4 spaces, as in `npm-publish.yml`).

2. **Gate the publish workflow.** In `.github/workflows/npm-publish.yml`, insert after the "Install all dependencies" step and **before** the "Build package" step:

   ```yaml
             - name: Typecheck
               run: bunx tsc --noEmit

             - name: Lint
               run: bunx biome lint .

             - name: Run tests
               run: bun run test

             - name: Bundle size regression
               run: bun test test/regression-bundle.test.ts
   ```

   Keep everything else in that workflow unchanged (the provenance permissions block, version/tag detection, Node setup, `npm publish` step).

3. **(Optional but recommended)** Add to `package.json` scripts so the gate is one command locally and in CI:

   ```json
   "check": "bunx tsc --noEmit && bunx biome lint . && bun run test && bun test test/regression-bundle.test.ts"
   ```

   If added, CI steps 3–6 in `ci.yml` and the publish gate can each be collapsed to `bun run check` — but keep separate named steps in `ci.yml` for readable failure annotations; use the script only in `npm-publish.yml`.

4. **Verify** by pushing to a branch and opening a draft PR against `next`; confirm both jobs run and the `test` job is green. Confirm the `performance` job is marked neutral/failed without failing the run (because of `continue-on-error`).

## Edge cases a weaker model would likely miss

- **`bun run test` already excludes regression tests** (`--path-ignore-patterns=**/regression*` in package.json) — do not run plain `bun test`, which would include the performance regression suite and make CI flaky.
- **Performance regression tests compare against the published stable release** (`@zeix/cause-effect-stable` npm alias) with a 20% margin and 1 ms floor (`test/regression-performance.test.ts`). On shared GitHub runners these timings are noisy — that's why the `performance` job is separate with `continue-on-error: true`. Do NOT put it in the required job, and do NOT delete it either; it's useful signal on large regressions.
- **Bundle regression is deterministic** (builds with `Bun.build` and measures bytes) — it belongs in the required job.
- **`biome ci` / `biome check` include formatting and fail on this repo** (46 format diffs, verified). Only `biome lint` is clean. If someone later formats the repo, CI can be upgraded to `biome ci .` — leave a one-line comment in the workflow noting this.
- **`bun install --frozen-lockfile`** — the publish workflow currently uses plain `bun install`; keep publish as-is (it must tolerate lockfile drift at release time is arguable, but out of scope), use frozen in CI so PRs can't silently change dependencies.
- **`typescript` is a devDependency and a peerDependency** — `bun install` installs it; `bunx tsc` resolves the local 6.x, not a global one. No extra setup needed.
- **The `types/` directory is gitignored?** Check: it is committed (exists in repo). `bunx tsc --noEmit` uses `tsconfig.json`, which *excludes* `types/` and `index.js` — no conflict with stale build artifacts.
- **Branch protection is not configurable from the repo** — after merging, the user must mark the `test` job as a required status check in GitHub settings for `main` and `next`. Note this in the PR description.

## Acceptance criteria

1. `ci.yml` exists; on a test PR, the `test` job passes all six steps and the `performance` job runs without being able to fail the overall check.
2. `npm-publish.yml` contains typecheck/lint/test/bundle-regression steps that execute before "Build package".
3. `act`-free validation: `bunx tsc --noEmit && bunx biome lint . && bun run test && bun test test/regression-bundle.test.ts && bun run build` exits 0 locally (this is exactly what the required job runs).
4. YAML is valid: `bunx yaml-lint .github/workflows/ci.yml` or simply GitHub's workflow parser accepting the file on push (no "workflow file issue" annotation).
