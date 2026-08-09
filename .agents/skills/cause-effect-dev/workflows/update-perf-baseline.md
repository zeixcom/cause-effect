<required_reading>
1. `test/regression-performance.test.ts` — how the two sides are bundled and compared
2. `package.json` — the `@zeix/cause-effect-stable` devDependency pin
</required_reading>

<context>
`test/regression-performance.test.ts` measures the working tree against a published release installed as `@zeix/cause-effect-stable` (an npm alias of `@zeix/cause-effect`). The harness bundles **both** sides from their own `index.ts` with identical `Bun.build` options, so the baseline package must ship `index.ts` and `src/` — it does not use the published `index.js`.

Two invariants keep the comparison honest:

- **The pin is exact** (`npm:@zeix/cause-effect@1.4.1`, not `npm:@zeix/cause-effect`). A floating specifier re-baselines silently on every `bun install`, so the test would measure against whatever npm last resolved rather than a known point.
- **The baseline stays close to HEAD.** Every release the baseline falls behind adds its own drift to the measured ratio. Several releases of accumulated drift eventually cross `PERF_MARGIN` and the test starts failing on branches that changed no code.
</context>

<when_to_run>
- After every minor release (`1.4.x` → `1.5.0`) — required.
- After a patch release that changed hot paths (graph traversal, `ensureFresh`, node creation) — recommended.
- When the perf test fails but the branch changed no source code, and the pin is more than one minor behind.
</when_to_run>

<process>
## Step 1: Confirm the target release is published

```bash
npm view @zeix/cause-effect dist-tags --json
```

Baseline against a real published version, normally `latest`. Never point the pin at an unpublished or beta version.

## Step 2: Update the pin

Edit `package.json` and set the exact version:

```json
"@zeix/cause-effect-stable": "npm:@zeix/cause-effect@<version>",
```

## Step 3: Install

```bash
bun install
```

Commit the resulting `bun.lock` — CI installs with `--frozen-lockfile` and fails without it.

## Step 4: Verify the baseline is usable

```bash
ls node_modules/@zeix/cause-effect-stable/
```

`index.ts` and `src/` must both be present. If either is missing, the release's `files` field was wrong and the harness cannot bundle it — fix `files` and publish a patch rather than working around it in the test.

## Step 5: Run the regression test

```bash
bun test test/regression-performance.test.ts
```

Immediately after re-baselining, HEAD and the baseline are near-identical code, so every scenario should report a ratio close to `1.00x`. Anything above about `1.10x` at this point means either the pin is wrong or an unreleased change on HEAD is genuinely slower — investigate before committing.

## Step 6: Commit

```
chore: baseline performance regression against v<version>
```
</process>

<success_criteria>
- `package.json` pins an exact published version, not a floating specifier
- `bun.lock` is updated and committed
- The baseline package ships `index.ts` and `src/`
- All nine scenarios pass with ratios near `1.00x`
</success_criteria>
