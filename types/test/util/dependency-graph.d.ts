import type { TestConfig } from './framework-types';
import type { Computed, ReactiveFramework, Signal } from './reactive-framework';
export interface Graph {
    sources: Signal<number>[];
    layers: Computed<number>[][];
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
export declare function makeGraph(framework: ReactiveFramework, config: TestConfig, counter: Counter): Graph;
/**
 * Execute the graph by writing one of the sources and reading some or all of the leaves.
 *
 * @return the sum of all leaf values
 */
export declare function runGraph(graph: Graph, iterations: number, readFraction: number, framework: ReactiveFramework): number;
export declare class Counter {
    count: number;
}
