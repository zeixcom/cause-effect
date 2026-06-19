# @zeix/correlation-prediction

Lightweight reactive ML primitives (Neuron, Layer) built on `@zeix/cause-effect`.
Distinct from cause-effect's deterministic signal graph: these signals model weighted
connections, forward propagation, and backpropagation for educational ML experimentation.

> **Status:** Experimental. Design decisions documented in
> [`adr/0017-public-api-decoupling-for-ml-primitives.md`](../../adr/0017-public-api-decoupling-for-ml-primitives.md).
> Depends on `@zeix/cause-effect` via its public API only — no graph internals.

## Dev setup

This package consumes `@zeix/cause-effect` from the local working tree during development.
Because cause-effect's source lives at the repo root (not under `packages/`), it is not a
workspace *member*, so the standard `workspace:*` protocol does not link it. Instead, link the
local source manually once after clone:

```sh
mkdir -p packages/correlation-prediction/node_modules/@zeix
ln -s "$(pwd)" packages/correlation-prediction/node_modules/@zeix/cause-effect
```

This symlink is git-ignored (dev-only). In CI and after publish, the npm version range in
`package.json` resolves to the published package, which ships its TypeScript source.

## Usage

```ts
import { createState } from '@zeix/cause-effect'
import { createNeuron } from '@zeix/correlation-prediction'

const input1 = createState(0.5)
const input2 = createState(0.3)
const neuron = createNeuron([input1, input2], { activation: 'sigmoid' })

console.log(neuron.get())      // forward propagation
neuron.train(0.8)              // backpropagation
```
