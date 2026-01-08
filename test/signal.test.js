"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_ts_1 = require("../index.ts");
/* === Tests === */
(0, bun_test_1.describe)('createSignal', function () {
    (0, bun_test_1.describe)('type inference and runtime behavior', function () {
        (0, bun_test_1.test)('converts array to List<T>', function () {
            var _a, _b;
            var result = (0, index_ts_1.createSignal)([
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ]);
            // Runtime behavior
            (0, bun_test_1.expect)((0, index_ts_1.isList)(result)).toBe(true);
            (0, bun_test_1.expect)((_a = result.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toEqual({ id: 1, name: 'Alice' });
            (0, bun_test_1.expect)((_b = result.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toEqual({ id: 2, name: 'Bob' });
            // Type inference test - now correctly returns List<{ id: number; name: string }>
            var typedResult = result;
            (0, bun_test_1.expect)(typedResult).toBeDefined();
        });
        (0, bun_test_1.test)('converts empty array to ArrayStore<never[]>', function () {
            var result = (0, index_ts_1.createSignal)([]);
            // Runtime behavior
            (0, bun_test_1.expect)((0, index_ts_1.isList)(result)).toBe(true);
            (0, bun_test_1.expect)(result.length).toBe(0);
            (0, bun_test_1.expect)(Object.keys(result).length).toBe(0);
        });
        (0, bun_test_1.test)('converts record to Store<T>', function () {
            var record = { name: 'Alice', age: 30 };
            var result = (0, index_ts_1.createSignal)(record);
            // Runtime behavior
            (0, bun_test_1.expect)((0, index_ts_1.isStore)(result)).toBe(true);
            (0, bun_test_1.expect)(result.name.get()).toBe('Alice');
            (0, bun_test_1.expect)(result.age.get()).toBe(30);
            // Type inference test - should be Store<{name: string, age: number}>
            var typedResult = result;
            (0, bun_test_1.expect)(typedResult).toBeDefined();
        });
        (0, bun_test_1.test)('converts function to Computed<T>', function () {
            var fn = function () { return Math.random(); };
            var result = (0, index_ts_1.createSignal)(fn);
            // Runtime behavior - functions are correctly converted to Computed
            (0, bun_test_1.expect)((0, index_ts_1.isComputed)(result)).toBe(true);
            (0, bun_test_1.expect)(typeof result.get()).toBe('number');
            // Type inference test - should be Computed<number>
            var typedResult = result;
            (0, bun_test_1.expect)(typedResult).toBeDefined();
        });
        (0, bun_test_1.test)('converts primitive to State<T>', function () {
            var num = 42;
            var result = (0, index_ts_1.createSignal)(num);
            // Runtime behavior - primitives are correctly converted to State
            (0, bun_test_1.expect)((0, index_ts_1.isState)(result)).toBe(true);
            (0, bun_test_1.expect)(result.get()).toBe(42);
            // Type inference test - should be State<number>
            var typedResult = result;
            (0, bun_test_1.expect)(typedResult).toBeDefined();
        });
        (0, bun_test_1.test)('converts object to State<T>', function () {
            var obj = new Date('2024-01-01');
            var result = (0, index_ts_1.createSignal)(obj);
            // Runtime behavior - objects are correctly converted to State
            (0, bun_test_1.expect)((0, index_ts_1.isState)(result)).toBe(true);
            (0, bun_test_1.expect)(result.get()).toBe(obj);
            // Type inference test - should be State<Date>
            var typedResult = result;
            (0, bun_test_1.expect)(typedResult).toBeDefined();
        });
    });
    (0, bun_test_1.describe)('edge cases', function () {
        (0, bun_test_1.test)('handles nested arrays', function () {
            var _a, _b;
            var result = (0, index_ts_1.createSignal)([
                [1, 2],
                [3, 4],
            ]);
            (0, bun_test_1.expect)((0, index_ts_1.isList)(result)).toBe(true);
            // With the fixed behavior, nested arrays should be recovered as arrays
            var firstElement = (_a = result.at(0)) === null || _a === void 0 ? void 0 : _a.get();
            var secondElement = (_b = result.at(1)) === null || _b === void 0 ? void 0 : _b.get();
            // The expected behavior - nested arrays are recovered as arrays
            (0, bun_test_1.expect)(firstElement).toEqual([1, 2]);
            (0, bun_test_1.expect)(secondElement).toEqual([3, 4]);
        });
        (0, bun_test_1.test)('handles arrays with mixed types', function () {
            var _a, _b, _c;
            var mixedArr = [1, 'hello', { key: 'value' }];
            var result = (0, index_ts_1.createSignal)(mixedArr);
            (0, bun_test_1.expect)((0, index_ts_1.isList)(result)).toBe(true);
            (0, bun_test_1.expect)((_a = result.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(1);
            (0, bun_test_1.expect)((_b = result.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe('hello');
            (0, bun_test_1.expect)((_c = result.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toEqual({ key: 'value' });
        });
    });
});
(0, bun_test_1.describe)('Signal compatibility', function () {
    (0, bun_test_1.test)('all results implement Signal<T> interface', function () {
        var arraySignal = (0, index_ts_1.createSignal)([1, 2, 3]);
        var recordSignal = (0, index_ts_1.createSignal)({ a: 1, b: 2 });
        var primitiveSignal = (0, index_ts_1.createSignal)(42);
        var functionSignal = (0, index_ts_1.createSignal)(function () { return 'hello'; });
        var stateSignal = (0, index_ts_1.createSignal)(new index_ts_1.State(true));
        // All should have get() method
        (0, bun_test_1.expect)(typeof arraySignal.get).toBe('function');
        (0, bun_test_1.expect)(typeof recordSignal.get).toBe('function');
        (0, bun_test_1.expect)(typeof primitiveSignal.get).toBe('function');
        (0, bun_test_1.expect)(typeof functionSignal.get).toBe('function');
        (0, bun_test_1.expect)(typeof stateSignal.get).toBe('function');
        // All should be assignable to Signal<T>
        var signals = [
            arraySignal,
            recordSignal,
            primitiveSignal,
            functionSignal,
            stateSignal,
        ];
        (0, bun_test_1.expect)(signals.length).toBe(5);
    });
});
(0, bun_test_1.describe)('Type precision tests', function () {
    (0, bun_test_1.test)('array type should infer element type correctly', function () {
        var _a, _b;
        // Test that arrays infer the correct element type
        var stringArray = ['a', 'b', 'c'];
        var stringArraySignal = (0, index_ts_1.createSignal)(stringArray);
        // Should be List<string>
        (0, bun_test_1.expect)((_a = stringArraySignal.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe('a');
        var numberArray = [1, 2, 3];
        var numberArraySignal = (0, index_ts_1.createSignal)(numberArray);
        // Should be List<number>
        (0, bun_test_1.expect)(typeof ((_b = numberArraySignal.at(0)) === null || _b === void 0 ? void 0 : _b.get())).toBe('number');
    });
    (0, bun_test_1.test)('complex object arrays maintain precise typing', function () {
        var _a;
        var users = [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
        ];
        var usersSignal = (0, index_ts_1.createSignal)(users);
        // Should maintain User type for each element
        var firstUser = (_a = usersSignal.at(0)) === null || _a === void 0 ? void 0 : _a.get();
        (0, bun_test_1.expect)(firstUser === null || firstUser === void 0 ? void 0 : firstUser.id).toBe(1);
        (0, bun_test_1.expect)(firstUser === null || firstUser === void 0 ? void 0 : firstUser.name).toBe('Alice');
        (0, bun_test_1.expect)(firstUser === null || firstUser === void 0 ? void 0 : firstUser.email).toBe('alice@example.com');
    });
    (0, bun_test_1.describe)('Type inference issues', function () {
        (0, bun_test_1.test)('demonstrates current type inference problem', function () {
            var _a, _b;
            var result = (0, index_ts_1.createSignal)([{ id: 1 }, { id: 2 }]);
            // Let's verify the actual behavior
            (0, bun_test_1.expect)((0, index_ts_1.isList)(result)).toBe(true);
            (0, bun_test_1.expect)((_a = result.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toEqual({ id: 1 });
            (0, bun_test_1.expect)((_b = result.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toEqual({ id: 2 });
            // Type assertion test - this should now work with correct typing
            var typedResult = result;
            (0, bun_test_1.expect)(typedResult).toBeDefined();
            // This should work if types are correct
            var processor = {
                process: function (signal) {
                    // Process the signal
                    var value = signal.get();
                    (0, bun_test_1.expect)(value).toHaveProperty('id');
                },
            };
            // This call should work without type errors
            var item = result.at(0);
            if (item)
                processor.process(item);
        });
        (0, bun_test_1.test)('verifies fixed type inference for external library compatibility', function () {
            var items = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ];
            var signal = (0, index_ts_1.createSignal)(items);
            var firstItemSignal = signal.at(0);
            var secondItemSignal = signal.at(1);
            // Runtime behavior works correctly
            (0, bun_test_1.expect)((0, index_ts_1.isList)(signal)).toBe(true);
            (0, bun_test_1.expect)(firstItemSignal === null || firstItemSignal === void 0 ? void 0 : firstItemSignal.get()).toEqual({ id: 1, name: 'Alice' });
            (0, bun_test_1.expect)(secondItemSignal === null || secondItemSignal === void 0 ? void 0 : secondItemSignal.get()).toEqual({ id: 2, name: 'Bob' });
            // Type inference should now work correctly:
            var properlyTyped = signal;
            (0, bun_test_1.expect)(properlyTyped).toBeDefined();
            var api = {
                process: function (_key, signal) { return signal.get(); },
            };
            // These calls should work with proper typing now
            var result1 = firstItemSignal && api.process('0', firstItemSignal);
            var result2 = secondItemSignal && api.process('1', secondItemSignal);
            (0, bun_test_1.expect)(result1).toEqual({ id: 1, name: 'Alice' });
            (0, bun_test_1.expect)(result2).toEqual({ id: 2, name: 'Bob' });
            // Verify the types are precise
            (0, bun_test_1.expect)(typeof (result1 === null || result1 === void 0 ? void 0 : result1.id)).toBe('number');
            (0, bun_test_1.expect)(typeof (result1 === null || result1 === void 0 ? void 0 : result1.name)).toBe('string');
        });
    });
});
