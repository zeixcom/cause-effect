import { Random } from "random";

/** interface for a reactive framework.
 *
 * Implement this interface to add a new reactive framework to the test and performance test suite.
 */
export interface ReactiveFramework {
  name: string;
  signal<T>(initialValue: T): Signal<T>;
  computed<T>(fn: () => T): Computed<T>;
  effect(fn: () => void): void;
  withBatch<T>(fn: () => T): void;
  withBuild<T>(fn: () => T): T;
}

export interface Signal<T> {
  read(): T;
  write(v: T): void;
}

export interface Computed<T> {
  read(): T;
}

export interface Graph {
  sources: Signal<number>[];
  layers: Computed<number>[][];
}

export interface TestResult {
  sum: number;
  count: number;
}

/** Parameters for a running a performance benchmark test
 *
 * The benchmarks create a rectangular grid of reactive elements, with
 * mutable signals in the first level, computed elements in the middle levels,
 * and read effect elements in the last level.
 *
 * Each test iteration modifies one signal, and then reads specified
 * fraction of the effect elements.
 *
 * Each non-signal node sums values from a specified number of elements
 * in the preceding layer. Some nodes are dynamic, and read vary
 * the number of sources the read for the sum.
 *
 * Tests may optionally provide result values to verify the sum
 * of all read effect elements in all iterations, and the total
 * number of non-signal updated.
 */
export interface TestConfig {
  /** friendly name for the test, should be unique */
  name?: string;

  /** width of dependency graph to construct */
  width: number;

  /** depth of dependency graph to construct */
  totalLayers: number;

  /** fraction of nodes that are static */ // TODO change to dynamicFraction
  staticFraction: number;

  /** construct a graph with number of sources in each node */
  nSources: number;

  /** fraction of [0, 1] elements in the last layer from which to read values in each test iteration */
  readFraction: number;

  /** number of test iterations */
  iterations: number;

  /** sum and count of all iterations, for verification */
  expected: Partial<TestResult>;
}


/**
 * Make a rectangular dependency graph, with an equal number of source elements
 * and computation elements at every layer.
 *
 * @param width number of source elements and number of computed elements per layer
 * @param totalLayers total number of source and computed layers
 * @param staticFraction every nth computed node is static (1 = all static, 3 = 2/3rd are dynamic)
 * @returns the graph
 */
export function makeGraph(
  framework: ReactiveFramework,
  config: TestConfig,
  counter: Counter
): Graph {
  const { width, totalLayers, staticFraction, nSources } = config;

  return framework.withBuild(() => {
    const sources = new Array(width).fill(0).map((_, i) => framework.signal(i));
    const rows = makeDependentRows(
      sources,
      totalLayers - 1,
      counter,
      staticFraction,
      nSources,
      framework
    );
    const graph = { sources, layers: rows };
    return graph;
  });
}

/**
 * Execute the graph by writing one of the sources and reading some or all of the leaves.
 *
 * @return the sum of all leaf values
 */
export function runGraph(
  graph: Graph,
  iterations: number,
  readFraction: number,
  framework: ReactiveFramework
): number {
  const rand = new Random("seed");
  const { sources, layers } = graph;
  const leaves = layers[layers.length - 1];
  const skipCount = Math.round(leaves.length * (1 - readFraction));
  const readLeaves = removeElems(leaves, skipCount, rand);
  const frameworkName = framework.name.toLowerCase();
  // const start = Date.now();
  let sum = 0;

  if (frameworkName === "s-js" || frameworkName === "solidjs") {
    // [S.js freeze](https://github.com/adamhaile/S#sdatavalue) doesn't allow different values to be set during a single batch, so special case it.
    for (let i = 0; i < iterations; i++) {
      framework.withBatch(() => {
        const sourceDex = i % sources.length;
        sources[sourceDex].write(i + sourceDex);
      });

      for (const leaf of readLeaves) {
        leaf.read();
      }
    }

    sum = readLeaves.reduce((total, leaf) => leaf.read() + total, 0);
  } else {
    framework.withBatch(() => {
      for (let i = 0; i < iterations; i++) {
        // Useful for debugging edge cases for some frameworks that experience
        // dramatic slow downs for certain test configurations. These are generally
        // due to `computed` effects not being cached efficiently, and as the number
        // of layers increases, the uncached `computed` effects are re-evaluated in
        // an `O(n^2)` manner where `n` is the number of layers.
        // if (i % 100 === 0) {
        //   console.log("iteration:", i, "delta:", Date.now() - start);
        // }

        const sourceDex = i % sources.length;
        sources[sourceDex].write(i + sourceDex);

        for (const leaf of readLeaves) {
          leaf.read();
        }
      }

      sum = readLeaves.reduce((total, leaf) => leaf.read() + total, 0);
    });
  }

  return sum;
}

function removeElems<T>(src: T[], rmCount: number, rand: Random): T[] {
  const copy = src.slice();
  for (let i = 0; i < rmCount; i++) {
    const rmDex = rand.int(0, copy.length - 1);
    copy.splice(rmDex, 1);
  }
  return copy;
}

export class Counter {
  count = 0;
}

function makeDependentRows(
  sources: Computed<number>[],
  numRows: number,
  counter: Counter,
  staticFraction: number,
  nSources: number,
  framework: ReactiveFramework
): Computed<number>[][] {
  let prevRow = sources;
  const rand = new Random("seed");
  const rows: any = [];
  for (let l = 0; l < numRows; l++) {
    const row = makeRow(
      prevRow,
      counter,
      staticFraction,
      nSources,
      framework,
      l,
      rand
    );
    rows.push(row);
    prevRow = row;
  }
  return rows;
}

function makeRow(
  sources: Computed<number>[],
  counter: Counter,
  staticFraction: number,
  nSources: number,
  framework: ReactiveFramework,
  _layer: number,
  random: Random
): Computed<number>[] {
  return sources.map((_, myDex) => {
    const mySources: Computed<number>[] = [];
    for (let sourceDex = 0; sourceDex < nSources; sourceDex++) {
      mySources.push(sources[(myDex + sourceDex) % sources.length]);
    }

    const staticNode = random.float() < staticFraction;
    if (staticNode) {
      // static node, always reference sources
      return framework.computed(() => {
        counter.count++;

        let sum = 0;
        for (const src of mySources) {
          sum += src.read();
        }
        return sum;
      });
    } else {
      // dynamic node, drops one of the sources depending on the value of the first element
      const first = mySources[0];
      const tail = mySources.slice(1);
      const node = framework.computed(() => {
        counter.count++;
        let sum = first.read();
        const shouldDrop = sum & 0x1;
        const dropDex = sum % tail.length;

        for (let i = 0; i < tail.length; i++) {
          if (shouldDrop && i === dropDex) continue;
          sum += tail[i].read();
        }

        return sum;
      });
      return node;
    }
  });
}
