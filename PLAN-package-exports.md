# PLAN: Correct npm Packaging (exports map, tree-shaking, peer-dep metadata)

## Goal

Fix distribution metadata so the package resolves correctly and tree-shakes in all supported toolchains. Current problems in `package.json`:

1. **No `exports` map** — no explicit entry conditions, no `types` condition, and deep imports into package internals are uncontrolled.
2. **`"module": "index.ts"` points at TypeScript source.** Bundlers that honor the `module` field (webpack, older Rollup configs) will try to parse raw TS from `node_modules`, which most consumer configs exclude from transpilation → build errors. `module` must point to JS.
3. **No `"sideEffects": false`** — REQUIREMENTS.md explicitly demands "the library must remain tree-shakable", but without this flag webpack retains the whole bundle. (Verified: the codebase has no module-level side effects — only const declarations, class definitions, and pure helpers; `Object.getPrototypeOf(async () => {})` in `src/util.ts` and the module-scope `WeakSet`/arrays in `graph.ts`/`slot.ts` are allocation-only, side-effect-free.)
4. **`main` is a *minified* bundle** (`index.js`, built with `bun build --minify`). Publishing minified code hurts consumer debugging and bug reports; consumers' bundlers minify anyway. The unminified `index.dev.js` exists but nothing points to it.
5. **`typescript` is a hard `peerDependency`** — JS-only consumers get an unresolvable-peer warning on every install. It should be optional.
6. **Packaging is controlled by a fragile `.npmignore`** with negation patterns; an explicit `files` allowlist is safer.

## Files to touch

- `package.json`
- `.npmignore` — delete (replaced by `files`)
- `test/regression-bundle.test.ts` — no change needed (it builds from `index.ts` on the fly, not from the shipped `index.js`); verify only.
- `REQUIREMENTS.md` — no change needed unless acceptance step 5 finds issues.

## Implementation steps

1. **Swap the roles of the two build outputs** so the published entry is the *unminified* ESM bundle. In `package.json` `scripts.build`, change:

   ```
   bunx tsc --project tsconfig.build.json && bun build index.ts --outdir ./ --minify && bun build index.ts --outfile index.dev.js
   ```

   to:

   ```
   bunx tsc --project tsconfig.build.json && bun build index.ts --outfile index.js
   ```

   and delete `index.dev.js` from the repo (`git rm index.dev.js`). The minified artifact serves no consumer (bundlers minify; the size budget is enforced by `test/regression-bundle.test.ts`, which builds its own minified bundle from source). If the user prefers to keep a minified file for CDN-style usage, instead keep both files and point a `"production"` exports condition at the minified one — but the default/simple path is one unminified `index.js`.

2. **Rewrite the packaging fields in `package.json`:**

   ```json
   "main": "index.js",
   "types": "types/index.d.ts",
   "exports": {
       ".": {
           "types": "./types/index.d.ts",
           "bun": "./index.ts",
           "default": "./index.js"
       },
       "./package.json": "./package.json"
   },
   "sideEffects": false,
   "files": [
       "index.js",
       "index.ts",
       "src",
       "types",
       "SECURITY.md"
   ],
   ```

   - **Delete the `"module": "index.ts"` field entirely.** With an `exports` map, `module` is ignored by modern resolvers; leaving it pointing at TS keeps the webpack hazard alive for tools that still read it. Do not repoint it at `index.js` — just remove it.
   - The `"bun"` condition lets Bun consumers (Le Truc, per REQUIREMENTS.md) resolve the TS source directly — this is why `index.ts` and `src/` stay in `files`.
   - `README.md` and `LICENSE` are always included by npm automatically; they do not need to be in `files`.
   - Key order inside the `"."` conditions matters: `"types"` must come first, `"default"` last.

3. **Make the TypeScript peer dependency optional:**

   ```json
   "peerDependenciesMeta": {
       "typescript": {
           "optional": true
       }
   }
   ```

4. **Delete `.npmignore`.** With a `files` allowlist present, npm ignores `.npmignore` for inclusion logic anyway; keeping both invites drift.

5. **Validate the package shape:**
   - `bun run build` (regenerates `types/` and `index.js`).
   - `npm pack --dry-run` — inspect the file list: exactly `index.js`, `index.ts`, `src/**`, `types/**`, `package.json`, `README.md`, `LICENSE`, `SECURITY.md`. No `test/`, no `adr/`, no `.agents/`, no `bench/`.
   - `bunx publint` — must report no errors (warnings about `bun` condition ordering are acceptable if any).
   - `bunx @arethetypeswrong/cli --pack .` — must show ESM resolution finding `types/index.d.ts` for the `import` condition; "no types for require" is expected and fine (the library is ESM-only by design; see the comment in `src/graph.ts:187–191` about live bindings — do NOT add a CJS build to satisfy the tool).
   - Smoke test in a scratch dir: `npm pack`, then in `/tmp/pkgtest` create `package.json` (`"type": "module"`), `npm i <tarball>`, and run `node -e "import('@zeix/cause-effect').then(m => console.log(typeof m.createState))"` → prints `function`.

## Edge cases a weaker model would likely miss

- **Do NOT add a CommonJS build.** `src/graph.ts` documents that `activeSink`/`activeOwner`/`batchDepth` are exported mutable `let` bindings relying on ESM live-binding semantics; a CJS transform snapshots them and silently breaks dependency tracking. ESM-only is a load-bearing design decision (REQUIREMENTS.md), not an oversight.
- **The `exports` map breaks deep imports** like `@zeix/cause-effect/src/nodes/list.ts`. Nothing in the repo or docs advertises deep imports, and the barrel re-exports everything, so this is acceptable — but mention it in the changelog entry (via the changelog-keeper skill) as a potentially breaking packaging change; consider a minor (not patch) version bump.
- **The `"bun"` condition must appear before `"default"`** or Bun will never reach it. Conditions are matched in object order.
- **`sideEffects: false` is a promise, not a flag** — if anyone later adds a module-level side effect (e.g., a global registration, a polyfill import), tree-shaking will silently drop it in consumer builds. Add a short comment in ARCHITECTURE.md or a note in the cause-effect-dev skill reference if the team wants a guardrail; at minimum, the core-tree-shaking regression test (`bundleCoreGzipped`) partially covers this.
- **`types/index.d.ts` is generated by `tsc --project tsconfig.build.json`** and the publish workflow runs `bun run build` before `npm publish` — so `files: ["types"]` is safe in CI. But `npm pack` from a fresh clone without building would produce a tarball missing fresh types; add `"prepack": "bun run build"`? **No** — npm runs `prepack` with npm's own node, and the build needs Bun. The publish workflow already builds; leave it, but note in the plan-executor's PR description that `npm pack` requires a prior `bun run build`.
- **`index.dev.js` removal**: grep the repo for references first (`grep -rn "index.dev" --exclude-dir=node_modules .`) — as of today it appears only in `package.json`'s build script and `.npmignore`; both are being edited by this plan. If it also appears in docs, update them.
- **The regression bundle test is independent of these changes** (it builds from `index.ts` with `Bun.build`), so size limits cannot regress from this plan — but run `bun run regression` anyway as a guard.

## Acceptance criteria

1. `npm pack --dry-run` lists exactly the intended files (see step 5) — no test/dev/tooling files.
2. `bunx publint` passes with no errors.
3. `bunx @arethetypeswrong/cli --pack .` shows correct ESM + types resolution (no ❌ for the `import` entrypoint; `require` failures acceptable/ESM-only).
4. Node smoke test (step 5, last bullet) prints `function`.
5. `package.json` contains `exports` (with `types` first), `sideEffects: false`, `files`, `peerDependenciesMeta.typescript.optional: true`, and no `module` field; `.npmignore` is deleted.
6. `bun test` and `bun run regression` still pass; `bun run build` produces `index.js` (unminified) and `types/`.
