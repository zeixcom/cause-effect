"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Counter = void 0;
exports.makeGraph = makeGraph;
exports.runGraph = runGraph;
var random_1 = require("random");
/**
 * Make a rectangular dependency graph, with an equal number of source elements
 * and computation elements at every layer.
 *
 * @param width number of source elements and number of computed elements per layer
 * @param totalLayers total number of source and computed layers
 * @param staticFraction every nth computed node is static (1 = all static, 3 = 2/3rd are dynamic)
 * @returns the graph
 */
function makeGraph(framework, config, counter) {
    var width = config.width, totalLayers = config.totalLayers, staticFraction = config.staticFraction, nSources = config.nSources;
    return framework.withBuild(function () {
        var sources = new Array(width)
            .fill(0)
            .map(function (_, i) { return framework.signal(i); });
        var rows = makeDependentRows(sources, totalLayers - 1, counter, staticFraction, nSources, framework);
        var graph = { sources: sources, layers: rows };
        return graph;
    });
}
/**
 * Execute the graph by writing one of the sources and reading some or all of the leaves.
 *
 * @return the sum of all leaf values
 */
function runGraph(graph, iterations, readFraction, framework) {
    var rand = new random_1.Random('seed');
    var sources = graph.sources, layers = graph.layers;
    var leaves = layers[layers.length - 1];
    var skipCount = Math.round(leaves.length * (1 - readFraction));
    var readLeaves = removeElems(leaves, skipCount, rand);
    var frameworkName = framework.name.toLowerCase();
    // const start = Date.now();
    var sum = 0;
    if (frameworkName === 's-js' || frameworkName === 'solidjs') {
        var _loop_1 = function (i) {
            framework.withBatch(function () {
                var sourceDex = i % sources.length;
                sources[sourceDex].write(i + sourceDex);
            });
            for (var _i = 0, readLeaves_1 = readLeaves; _i < readLeaves_1.length; _i++) {
                var leaf = readLeaves_1[_i];
                leaf.read();
            }
        };
        // [S.js freeze](https://github.com/adamhaile/S#sdatavalue) doesn't allow different values to be set during a single batch, so special case it.
        for (var i = 0; i < iterations; i++) {
            _loop_1(i);
        }
        sum = readLeaves.reduce(function (total, leaf) { return leaf.read() + total; }, 0);
    }
    else {
        framework.withBatch(function () {
            for (var i = 0; i < iterations; i++) {
                // Useful for debugging edge cases for some frameworks that experience
                // dramatic slow downs for certain test configurations. These are generally
                // due to `computed` effects not being cached efficiently, and as the number
                // of layers increases, the uncached `computed` effects are re-evaluated in
                // an `O(n^2)` manner where `n` is the number of layers.
                /* if (i % 100 === 0) {
           console.log("iteration:", i, "delta:", Date.now() - start);
        } */
                var sourceDex = i % sources.length;
                sources[sourceDex].write(i + sourceDex);
                for (var _i = 0, readLeaves_2 = readLeaves; _i < readLeaves_2.length; _i++) {
                    var leaf = readLeaves_2[_i];
                    leaf.read();
                }
            }
            sum = readLeaves.reduce(function (total, leaf) { return leaf.read() + total; }, 0);
        });
    }
    return sum;
}
function removeElems(src, rmCount, rand) {
    var copy = src.slice();
    for (var i = 0; i < rmCount; i++) {
        var rmDex = rand.int(0, copy.length - 1);
        copy.splice(rmDex, 1);
    }
    return copy;
}
var Counter = /** @class */ (function () {
    function Counter() {
        this.count = 0;
    }
    return Counter;
}());
exports.Counter = Counter;
function makeDependentRows(sources, numRows, counter, staticFraction, nSources, framework) {
    var prevRow = sources;
    var rand = new random_1.Random('seed');
    var rows = [];
    for (var l = 0; l < numRows; l++) {
        var row = makeRow(prevRow, counter, staticFraction, nSources, framework, l, rand);
        rows.push(row);
        prevRow = row;
    }
    return rows;
}
function makeRow(sources, counter, staticFraction, nSources, framework, _layer, random) {
    return sources.map(function (_, myDex) {
        var mySources = [];
        for (var sourceDex = 0; sourceDex < nSources; sourceDex++) {
            mySources.push(sources[(myDex + sourceDex) % sources.length]);
        }
        var staticNode = random.float() < staticFraction;
        if (staticNode) {
            // static node, always reference sources
            return framework.computed(function () {
                counter.count++;
                var sum = 0;
                for (var _i = 0, mySources_1 = mySources; _i < mySources_1.length; _i++) {
                    var src = mySources_1[_i];
                    sum += src.read();
                }
                return sum;
            });
        }
        else {
            // dynamic node, drops one of the sources depending on the value of the first element
            var first_1 = mySources[0];
            var tail_1 = mySources.slice(1);
            var node = framework.computed(function () {
                counter.count++;
                var sum = first_1.read();
                var shouldDrop = sum & 0x1;
                var dropDex = sum % tail_1.length;
                for (var i = 0; i < tail_1.length; i++) {
                    if (shouldDrop && i === dropDex)
                        continue;
                    sum += tail_1[i].read();
                }
                return sum;
            });
            return node;
        }
    });
}
