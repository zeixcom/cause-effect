"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyBenchResult = verifyBenchResult;
function verifyBenchResult(perfFramework, config, timedResult) {
    var testPullCounts = perfFramework.testPullCounts, framework = perfFramework.framework;
    var expected = config.expected;
    var result = timedResult.result;
    if (expected.sum) {
        console.assert(result.sum === expected.sum, "sum ".concat(framework.name, " ").concat(config.name, " result:").concat(result.sum, " expected:").concat(expected.sum));
    }
    if (expected.count &&
        (config.readFraction === 1 || testPullCounts) &&
        testPullCounts !== false) {
        console.assert(result.count === expected.count, "count ".concat(framework.name, " ").concat(config.name, " result:").concat(result.count, " expected:").concat(expected.count));
    }
}
