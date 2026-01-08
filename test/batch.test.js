"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_ts_1 = require("../index.ts");
/* === Tests === */
(0, bun_test_1.describe)('Batch', function () {
    (0, bun_test_1.test)('should be triggered only once after repeated state change', function () {
        var cause = new index_ts_1.State(0);
        var result = 0;
        var count = 0;
        (0, index_ts_1.createEffect)(function () {
            result = cause.get();
            count++;
        });
        (0, index_ts_1.batch)(function () {
            for (var i = 1; i <= 10; i++)
                cause.set(i);
        });
        (0, bun_test_1.expect)(result).toBe(10);
        (0, bun_test_1.expect)(count).toBe(2); // + 1 for effect initialization
    });
    (0, bun_test_1.test)('should be triggered only once when multiple signals are set', function () {
        var a = new index_ts_1.State(3);
        var b = new index_ts_1.State(4);
        var c = new index_ts_1.State(5);
        var sum = new index_ts_1.Memo(function () { return a.get() + b.get() + c.get(); });
        var result = 0;
        var count = 0;
        (0, index_ts_1.createEffect)(function () {
            var resolved = (0, index_ts_1.resolve)({ sum: sum });
            (0, index_ts_1.match)(resolved, {
                ok: function (_a) {
                    var res = _a.sum;
                    result = res;
                    count++;
                },
                err: function () { },
            });
        });
        (0, index_ts_1.batch)(function () {
            a.set(6);
            b.set(8);
            c.set(10);
        });
        (0, bun_test_1.expect)(result).toBe(24);
        (0, bun_test_1.expect)(count).toBe(2); // + 1 for effect initialization
    });
    (0, bun_test_1.test)('should prove example from README works', function () {
        // State: define an array of Signal<number>
        var signals = [new index_ts_1.State(2), new index_ts_1.State(3), new index_ts_1.State(5)];
        // Computed: derive a calculation ...
        var sum = new index_ts_1.Memo(function () {
            var v = signals.reduce(function (total, v) { return total + v.get(); }, 0);
            if (!Number.isFinite(v))
                throw new Error('Invalid value');
            return v;
        });
        var result = 0;
        var okCount = 0;
        var errCount = 0;
        // Effect: switch cases for the result
        (0, index_ts_1.createEffect)(function () {
            var resolved = (0, index_ts_1.resolve)({ sum: sum });
            (0, index_ts_1.match)(resolved, {
                ok: function (_a) {
                    var v = _a.sum;
                    result = v;
                    okCount++;
                    // console.log('Sum:', v)
                },
                err: function () {
                    errCount++;
                    // console.error('Error:', error)
                },
            });
        });
        (0, bun_test_1.expect)(okCount).toBe(1);
        (0, bun_test_1.expect)(result).toBe(10);
        // Batch: apply changes to all signals in a single transaction
        (0, index_ts_1.batch)(function () {
            signals.forEach(function (signal) { return signal.update(function (v) { return v * 2; }); });
        });
        (0, bun_test_1.expect)(okCount).toBe(2);
        (0, bun_test_1.expect)(result).toBe(20);
        // Provoke an error
        signals[0].set(NaN);
        (0, bun_test_1.expect)(errCount).toBe(1);
        (0, bun_test_1.expect)(okCount).toBe(2); // should not have changed due to error
        (0, bun_test_1.expect)(result).toBe(20); // should not have changed due to error
    });
});
