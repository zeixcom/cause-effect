"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_ts_1 = require("../index.ts");
(0, bun_test_1.describe)('diff', function () {
    (0, bun_test_1.describe)('basic object diffing', function () {
        (0, bun_test_1.test)('should detect no changes for identical objects', function () {
            var obj1 = { a: 1, b: 'hello' };
            var obj2 = { a: 1, b: 'hello' };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(false);
            (0, bun_test_1.expect)(Object.keys(result.add)).toHaveLength(0);
            (0, bun_test_1.expect)(Object.keys(result.change)).toHaveLength(0);
            (0, bun_test_1.expect)(Object.keys(result.remove)).toHaveLength(0);
        });
        (0, bun_test_1.test)('should detect additions', function () {
            var obj1 = { a: 1 };
            var obj2 = { a: 1, b: 'new' };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({ b: 'new' });
            (0, bun_test_1.expect)(Object.keys(result.change)).toHaveLength(0);
            (0, bun_test_1.expect)(Object.keys(result.remove)).toHaveLength(0);
        });
        (0, bun_test_1.test)('should detect removals', function () {
            var obj1 = { a: 1, b: 'hello' };
            var obj2 = { a: 1 };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(Object.keys(result.add)).toHaveLength(0);
            (0, bun_test_1.expect)(Object.keys(result.change)).toHaveLength(0);
            (0, bun_test_1.expect)(result.remove).toEqual({ b: index_ts_1.UNSET });
        });
        (0, bun_test_1.test)('should detect changes', function () {
            var obj1 = { a: 1, b: 'hello' };
            var obj2 = { a: 2, b: 'hello' };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(Object.keys(result.add)).toHaveLength(0);
            (0, bun_test_1.expect)(result.change).toEqual({ a: 2 });
            (0, bun_test_1.expect)(Object.keys(result.remove)).toHaveLength(0);
        });
        (0, bun_test_1.test)('should detect multiple changes', function () {
            var obj1 = { a: 1, b: 'hello', c: true };
            var obj2 = { a: 2, d: 'new', c: true };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({ d: 'new' });
            (0, bun_test_1.expect)(result.change).toEqual({ a: 2 });
            (0, bun_test_1.expect)(result.remove).toEqual({ b: index_ts_1.UNSET });
        });
    });
    (0, bun_test_1.describe)('primitive value handling', function () {
        (0, bun_test_1.test)('should handle string changes', function () {
            var obj1 = { text: 'hello' };
            var obj2 = { text: 'world' };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ text: 'world' });
        });
        (0, bun_test_1.test)('should handle number changes including special values', function () {
            var obj1 = { num: 42, nan: NaN, zero: -0 };
            var obj2 = { num: 43, nan: NaN, zero: +0 };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ num: 43, zero: +0 });
        });
        (0, bun_test_1.test)('should handle boolean changes', function () {
            var obj1 = { flag: true };
            var obj2 = { flag: false };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ flag: false });
        });
    });
    (0, bun_test_1.describe)('array handling', function () {
        (0, bun_test_1.test)('should detect no changes in identical arrays', function () {
            var obj1 = { arr: [1, 2, 3] };
            var obj2 = { arr: [1, 2, 3] };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(false);
        });
        (0, bun_test_1.test)('should detect changes in arrays', function () {
            var obj1 = { arr: [1, 2, 3] };
            var obj2 = { arr: [1, 2, 4] };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ arr: [1, 2, 4] });
        });
        (0, bun_test_1.test)('should detect length changes in arrays', function () {
            var obj1 = { arr: [1, 2, 3] };
            var obj2 = { arr: [1, 2] };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ arr: [1, 2] });
        });
        (0, bun_test_1.test)('should handle empty arrays', function () {
            var obj1 = { arr: [] };
            var obj2 = { arr: [1] };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ arr: [1] });
        });
        (0, bun_test_1.test)('should handle arrays with complex objects', function () {
            var obj1 = { arr: [{ id: 1, name: 'a' }] };
            var obj2 = { arr: [{ id: 1, name: 'b' }] };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ arr: [{ id: 1, name: 'b' }] });
        });
        (0, bun_test_1.test)('should handle nested arrays', function () {
            var obj1 = {
                matrix: [
                    [1, 2],
                    [3, 4],
                ],
            };
            var obj2 = {
                matrix: [
                    [1, 2],
                    [3, 5],
                ],
            };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({
                matrix: [
                    [1, 2],
                    [3, 5],
                ],
            });
        });
    });
    (0, bun_test_1.describe)('nested object handling', function () {
        (0, bun_test_1.test)('should detect no changes in nested objects', function () {
            var obj1 = {
                user: { id: 1, profile: { name: 'John', age: 30 } },
            };
            var obj2 = {
                user: { id: 1, profile: { name: 'John', age: 30 } },
            };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(false);
        });
        (0, bun_test_1.test)('should detect changes in nested objects', function () {
            var obj1 = {
                user: { id: 1, profile: { name: 'John', age: 30 } },
            };
            var obj2 = {
                user: { id: 1, profile: { name: 'Jane', age: 30 } },
            };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({
                user: { id: 1, profile: { name: 'Jane', age: 30 } },
            });
        });
        (0, bun_test_1.test)('should handle deeply nested structures', function () {
            var obj1 = {
                a: { b: { c: { d: { e: 'deep' } } } },
            };
            var obj2 = {
                a: { b: { c: { d: { e: 'deeper' } } } },
            };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({
                a: { b: { c: { d: { e: 'deeper' } } } },
            });
        });
    });
    (0, bun_test_1.describe)('type change handling', function () {
        (0, bun_test_1.test)('should handle changes from primitive to object', function () {
            var obj1 = { value: 'string' };
            var obj2 = { value: { type: 'object' } };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ value: { type: 'object' } });
        });
        (0, bun_test_1.test)('should handle changes from array to object', function () {
            var obj1 = { data: [1, 2, 3] };
            var obj2 = { data: { 0: 1, 1: 2, 2: 3 } };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ data: { 0: 1, 1: 2, 2: 3 } });
        });
        (0, bun_test_1.test)('should handle changes from object to array', function () {
            var obj1 = { data: { a: 1, b: 2 } };
            var obj2 = { data: [1, 2] };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ data: [1, 2] });
        });
    });
    (0, bun_test_1.describe)('special object types', function () {
        (0, bun_test_1.test)('should handle Date objects', function () {
            var date1 = new Date('2023-01-01');
            var date2 = new Date('2023-01-02');
            var obj1 = { timestamp: date1 };
            var obj2 = { timestamp: date2 };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ timestamp: date2 });
        });
        (0, bun_test_1.test)('should handle RegExp objects', function () {
            var regex1 = /hello/g;
            var regex2 = /world/g;
            var obj1 = { pattern: regex1 };
            var obj2 = { pattern: regex2 };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ pattern: regex2 });
        });
        (0, bun_test_1.test)('should handle identical special objects', function () {
            var date = new Date('2023-01-01');
            var obj1 = { timestamp: date };
            var obj2 = { timestamp: date };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(false);
        });
    });
    (0, bun_test_1.describe)('edge cases and error handling', function () {
        (0, bun_test_1.test)('should handle empty objects', function () {
            var result = (0, index_ts_1.diff)({}, {});
            (0, bun_test_1.expect)(result.changed).toBe(false);
        });
        (0, bun_test_1.test)('should detect circular references and throw error', function () {
            var circular1 = { a: 1 };
            circular1.self = circular1;
            var circular2 = { a: 1 };
            circular2.self = circular2;
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(circular1, circular2); }).toThrow(index_ts_1.CircularDependencyError);
        });
        (0, bun_test_1.test)('should handle objects with Symbol keys', function () {
            var _a, _b;
            var sym = Symbol('test');
            var obj1 = (_a = {},
                _a[sym] = 'value1',
                _a.normal = 'prop',
                _a);
            var obj2 = (_b = {},
                _b[sym] = 'value2',
                _b.normal = 'prop',
                _b);
            // Since Object.keys() doesn't include symbols,
            // the diff should not detect the symbol property change
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(false);
        });
        (0, bun_test_1.test)('should handle objects with non-enumerable properties', function () {
            var obj1 = { a: 1 };
            var obj2 = { a: 1 };
            Object.defineProperty(obj1, 'hidden', {
                value: 'secret1',
                enumerable: false,
            });
            Object.defineProperty(obj2, 'hidden', {
                value: 'secret2',
                enumerable: false,
            });
            // Since Object.keys() doesn't include non-enumerable properties,
            // the diff should not detect the hidden property change
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(false);
        });
    });
    (0, bun_test_1.describe)('performance edge cases', function () {
        (0, bun_test_1.test)('should handle large objects efficiently', function () {
            var createLargeObject = function (size, seed) {
                if (seed === void 0) { seed = 0; }
                var obj = {};
                for (var i = 0; i < size; i++) {
                    obj["prop".concat(i)] = i + seed;
                }
                return obj;
            };
            var obj1 = createLargeObject(1000);
            var obj2 = createLargeObject(1000, 1); // Same structure, different values
            var start = performance.now();
            var result = (0, index_ts_1.diff)(obj1, obj2);
            var duration = performance.now() - start;
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(Object.keys(result.change)).toHaveLength(1000);
            (0, bun_test_1.expect)(duration).toBeLessThan(100); // Should complete within 100ms
        });
        (0, bun_test_1.test)('should handle deeply nested structures without stack overflow', function () {
            // biome-ignore lint/suspicious/noExplicitAny: testing purposes
            var createDeepObject = function (depth) {
                var _a;
                var obj = { value: 'leaf' };
                for (var i = 0; i < depth; i++) {
                    obj = (_a = {}, _a["level".concat(i)] = obj, _a);
                }
                return obj;
            };
            var obj1 = createDeepObject(100);
            var obj2 = createDeepObject(100);
            obj2.level99.level98.level97.value = 'changed';
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
        });
    });
    (0, bun_test_1.describe)('optional keys handling', function () {
        (0, bun_test_1.test)('should handle optional keys correctly', function () {
            var obj1 = {
                required: 'test',
            };
            var obj2 = {
                required: 'test',
                optional: 42,
            };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({ optional: 42 });
        });
        (0, bun_test_1.test)('should handle undefined optional keys', function () {
            var obj1 = {
                required: 'test',
                maybeUndefined: 'defined',
            };
            var obj2 = {
                required: 'test',
                maybeUndefined: undefined,
            };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ maybeUndefined: undefined });
        });
    });
    (0, bun_test_1.describe)('array normalization to records', function () {
        (0, bun_test_1.test)('should correctly normalize arrays to records for comparison', function () {
            var obj1 = { items: ['a', 'b', 'c'] };
            var obj2 = { items: ['a', 'x', 'c'] };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ items: ['a', 'x', 'c'] });
        });
        (0, bun_test_1.test)('should handle sparse arrays correctly', function () {
            var sparse1 = [];
            sparse1[0] = 'a';
            sparse1[2] = 'c';
            var sparse2 = [];
            sparse2[0] = 'a';
            sparse2[1] = 'b';
            sparse2[2] = 'c';
            var obj1 = { sparse: sparse1 };
            var obj2 = { sparse: sparse2 };
            var result = (0, index_ts_1.diff)(obj1, obj2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.change).toEqual({ sparse: sparse2 });
        });
    });
    (0, bun_test_1.describe)('isEqual function', function () {
        (0, bun_test_1.describe)('primitives and fast paths', function () {
            (0, bun_test_1.test)('should handle identical values', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(1, 1)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)('hello', 'hello')).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(true, true)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(null, null)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(undefined, undefined)).toBe(true);
            });
            (0, bun_test_1.test)('should handle different primitives', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(1, 2)).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)('hello', 'world')).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(true, false)).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(null, undefined)).toBe(false);
            });
            (0, bun_test_1.test)('should handle special number values', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(NaN, NaN)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(-0, +0)).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(Infinity, Infinity)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(-Infinity, Infinity)).toBe(false);
            });
            (0, bun_test_1.test)('should handle type mismatches', function () {
                // @ts-expect-error deliberate type mismatch
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(1, '1')).toBe(false);
                // @ts-expect-error deliberate type mismatch
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(true, 1)).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(null, 0)).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(undefined, '')).toBe(false);
            });
            (0, bun_test_1.test)('should handle same object reference', function () {
                var obj = { a: 1 };
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(obj, obj)).toBe(true);
                var arr = [1, 2, 3];
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(arr, arr)).toBe(true);
            });
        });
        (0, bun_test_1.describe)('objects', function () {
            (0, bun_test_1.test)('should compare objects with same content', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
            });
            (0, bun_test_1.test)('should detect different object content', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({ a: 1 }, { a: 2 })).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({ a: 1 }, { b: 1 })).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({ a: 1, b: 2 }, { a: 1 })).toBe(false);
            });
            (0, bun_test_1.test)('should handle nested objects', function () {
                var obj1 = { user: { name: 'John', age: 30 } };
                var obj2 = { user: { name: 'John', age: 30 } };
                var obj3 = { user: { name: 'Jane', age: 30 } };
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(obj1, obj2)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(obj1, obj3)).toBe(false);
            });
            (0, bun_test_1.test)('should handle empty objects', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({}, {})).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({}, { a: 1 })).toBe(false);
            });
        });
        (0, bun_test_1.describe)('arrays', function () {
            (0, bun_test_1.test)('should compare arrays with same content', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)([1, 2, 3], [1, 2, 3])).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)([], [])).toBe(true);
            });
            (0, bun_test_1.test)('should detect different array content', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)([1, 2, 3], [1, 2, 4])).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)([1, 2], [1, 2, 3])).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)([1, 2, 3], [3, 2, 1])).toBe(false);
            });
            (0, bun_test_1.test)('should handle nested arrays', function () {
                var arr1 = [
                    [1, 2],
                    [3, 4],
                ];
                var arr2 = [
                    [1, 2],
                    [3, 4],
                ];
                var arr3 = [
                    [1, 2],
                    [3, 5],
                ];
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(arr1, arr2)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(arr1, arr3)).toBe(false);
            });
            (0, bun_test_1.test)('should handle arrays with objects', function () {
                var arr1 = [{ a: 1 }, { b: 2 }];
                var arr2 = [{ a: 1 }, { b: 2 }];
                var arr3 = [{ a: 2 }, { b: 2 }];
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(arr1, arr2)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(arr1, arr3)).toBe(false);
            });
        });
        (0, bun_test_1.describe)('mixed types', function () {
            (0, bun_test_1.test)('should handle array vs object', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)([1, 2], { 0: 1, 1: 2 })).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({ length: 2 }, [1, 2])).toBe(false);
            });
            (0, bun_test_1.test)('should handle object vs primitive', function () {
                // @ts-expect-error deliberate type mismatch
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({ a: 1 }, 'object')).toBe(false);
                // @ts-expect-error deliberate type mismatch
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(42, { value: 42 })).toBe(false);
            });
            (0, bun_test_1.test)('should handle complex mixed structures', function () {
                var obj1 = {
                    data: [1, 2, { nested: true }],
                    meta: { count: 3 },
                };
                var obj2 = {
                    data: [1, 2, { nested: true }],
                    meta: { count: 3 },
                };
                var obj3 = {
                    data: [1, 2, { nested: false }],
                    meta: { count: 3 },
                };
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(obj1, obj2)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(obj1, obj3)).toBe(false);
            });
        });
        (0, bun_test_1.describe)('edge cases', function () {
            (0, bun_test_1.test)('should handle circular references', function () {
                var circular1 = { a: 1 };
                circular1.self = circular1;
                var circular2 = { a: 1 };
                circular2.self = circular2;
                (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(circular1, circular2); }).toThrow(index_ts_1.CircularDependencyError);
            });
            (0, bun_test_1.test)('should handle special objects', function () {
                var date1 = new Date('2023-01-01');
                var date2 = new Date('2023-01-01');
                var date3 = new Date('2023-01-02');
                // Different Date objects with same time should be false (reference equality for special objects)
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(date1, date1)).toBe(true); // same reference
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(date1, date2)).toBe(false); // different references
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(date1, date3)).toBe(false);
            });
            (0, bun_test_1.test)('should handle null and undefined edge cases', function () {
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(null, null)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(undefined, undefined)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(null, undefined)).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)({}, null)).toBe(false);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)([], undefined)).toBe(false);
            });
        });
        (0, bun_test_1.describe)('performance comparison', function () {
            (0, bun_test_1.test)('should demonstrate isEqual vs Object.is difference', function () {
                // Objects with same content but different references
                var obj1 = {
                    user: { name: 'John', age: 30 },
                    items: [1, 2, 3],
                };
                var obj2 = {
                    user: { name: 'John', age: 30 },
                    items: [1, 2, 3],
                };
                // Object.is fails for content equality
                (0, bun_test_1.expect)(Object.is(obj1, obj2)).toBe(false);
                // isEqual succeeds for content equality
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(obj1, obj2)).toBe(true);
                // Both work for reference equality
                (0, bun_test_1.expect)(Object.is(obj1, obj1)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(obj1, obj1)).toBe(true);
                // Both work for primitive equality
                (0, bun_test_1.expect)(Object.is(42, 42)).toBe(true);
                (0, bun_test_1.expect)((0, index_ts_1.isEqual)(42, 42)).toBe(true);
            });
        });
    });
    (0, bun_test_1.describe)('non-plain object type safety', function () {
        (0, bun_test_1.test)('should handle Symbol objects without throwing TypeError', function () {
            var symbol = Symbol('test');
            var obj = { a: 1 };
            // These should not throw after we fix the bug
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(symbol, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, symbol); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(symbol, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should report additions when diffing from Symbol to valid object', function () {
            var symbol = Symbol('test');
            var obj = { a: 1, b: 'hello' };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result = (0, index_ts_1.diff)(symbol, obj);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({ a: 1, b: 'hello' });
            (0, bun_test_1.expect)(result.change).toEqual({});
            (0, bun_test_1.expect)(result.remove).toEqual({});
        });
        (0, bun_test_1.test)('should report removals when diffing from valid object to Symbol', function () {
            var obj = { a: 1, b: 'hello' };
            var symbol = Symbol('test');
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result = (0, index_ts_1.diff)(obj, symbol);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({});
            (0, bun_test_1.expect)(result.change).toEqual({});
            (0, bun_test_1.expect)(result.remove).toEqual({ a: 1, b: 'hello' });
        });
        (0, bun_test_1.test)('should handle Symbol to Symbol diff with no changes', function () {
            var symbol = Symbol('test');
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result = (0, index_ts_1.diff)(symbol, symbol);
            (0, bun_test_1.expect)(result.changed).toBe(false);
            (0, bun_test_1.expect)(result.add).toEqual({});
            (0, bun_test_1.expect)(result.change).toEqual({});
            (0, bun_test_1.expect)(result.remove).toEqual({});
        });
        (0, bun_test_1.test)('should handle different Symbols as changed', function () {
            var symbol1 = Symbol('test1');
            var symbol2 = Symbol('test2');
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result = (0, index_ts_1.diff)(symbol1, symbol2);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({});
            (0, bun_test_1.expect)(result.change).toEqual({});
            (0, bun_test_1.expect)(result.remove).toEqual({});
        });
        (0, bun_test_1.test)('should handle Date objects without throwing TypeError', function () {
            var date = new Date('2023-01-01');
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(date, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, date); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(date, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should report additions when diffing from Date to valid object', function () {
            var date = new Date('2023-01-01');
            var obj = { a: 1, b: 'hello' };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result = (0, index_ts_1.diff)(date, obj);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({ a: 1, b: 'hello' });
            (0, bun_test_1.expect)(result.change).toEqual({});
            (0, bun_test_1.expect)(result.remove).toEqual({});
        });
        (0, bun_test_1.test)('should report removals when diffing from valid object to Date', function () {
            var obj = { a: 1, b: 'hello' };
            var date = new Date('2023-01-01');
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result = (0, index_ts_1.diff)(obj, date);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({});
            (0, bun_test_1.expect)(result.change).toEqual({});
            (0, bun_test_1.expect)(result.remove).toEqual({ a: 1, b: 'hello' });
        });
        (0, bun_test_1.test)('should handle Map objects without throwing TypeError', function () {
            var map = new Map([['key', 'value']]);
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(map, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, map); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(map, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should report additions when diffing from Map to valid object', function () {
            var map = new Map([['key', 'value']]);
            var obj = { x: 10, y: 20 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result = (0, index_ts_1.diff)(map, obj);
            (0, bun_test_1.expect)(result.changed).toBe(true);
            (0, bun_test_1.expect)(result.add).toEqual({ x: 10, y: 20 });
            (0, bun_test_1.expect)(result.change).toEqual({});
            (0, bun_test_1.expect)(result.remove).toEqual({});
        });
        (0, bun_test_1.test)('should handle Set objects without throwing TypeError', function () {
            var set = new Set([1, 2, 3]);
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(set, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, set); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(set, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle Promise objects without throwing TypeError', function () {
            var promise = Promise.resolve('test');
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(promise, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, promise); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(promise, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle RegExp objects without throwing TypeError', function () {
            var regex = /test/g;
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(regex, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, regex); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(regex, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle Function objects without throwing TypeError', function () {
            var func = function () { return 'test'; };
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(func, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, func); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(func, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle Error objects without throwing TypeError', function () {
            var error = new Error('test error');
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(error, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, error); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(error, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle WeakMap objects without throwing TypeError', function () {
            var weakMap = new WeakMap();
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(weakMap, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, weakMap); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(weakMap, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle WeakSet objects without throwing TypeError', function () {
            var weakSet = new WeakSet();
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(weakSet, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, weakSet); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(weakSet, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle ArrayBuffer objects without throwing TypeError', function () {
            var buffer = new ArrayBuffer(8);
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(buffer, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, buffer); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(buffer, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should handle class instances without throwing TypeError', function () {
            var TestClass = /** @class */ (function () {
                function TestClass(value) {
                    this.value = value;
                }
                return TestClass;
            }());
            var instance = new TestClass('test');
            var obj = { a: 1 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(instance, obj); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.diff)(obj, instance); }).not.toThrow();
            // @ts-expect-error Testing runtime behavior with non-plain object types
            (0, bun_test_1.expect)(function () { return (0, index_ts_1.isEqual)(instance, obj); }).not.toThrow();
        });
        (0, bun_test_1.test)('should report additions/removals with mixed valid and invalid objects', function () {
            var func = function () { return 'test'; };
            var obj1 = { a: 1 };
            var obj2 = { b: 2 };
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result1 = (0, index_ts_1.diff)(func, obj1);
            (0, bun_test_1.expect)(result1.changed).toBe(true);
            (0, bun_test_1.expect)(result1.add).toEqual({ a: 1 });
            (0, bun_test_1.expect)(result1.remove).toEqual({});
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result2 = (0, index_ts_1.diff)(obj2, func);
            (0, bun_test_1.expect)(result2.changed).toBe(true);
            (0, bun_test_1.expect)(result2.add).toEqual({});
            (0, bun_test_1.expect)(result2.remove).toEqual({ b: 2 });
            // @ts-expect-error Testing runtime behavior with non-plain object types
            var result3 = (0, index_ts_1.diff)(func, func);
            (0, bun_test_1.expect)(result3.changed).toBe(false);
            (0, bun_test_1.expect)(result3.add).toEqual({});
            (0, bun_test_1.expect)(result3.remove).toEqual({});
        });
    });
});
(0, bun_test_1.describe)('sparse array handling', function () {
    (0, bun_test_1.test)('should properly diff sparse array representations', function () {
        // Simulate what happens in store: sparse array [10, 30, 50] with keys ["0", "2", "4"]
        // is represented as a regular array [10, 30, 50] when passed to diff()
        var oldSparseArray = [10, 30, 50]; // What current() returns for sparse store
        var newDenseArray = [100, 200, 300]; // What user wants to set
        var result = (0, index_ts_1.diff)(oldSparseArray, newDenseArray);
        // The problem: diff sees this as simple value changes at indices 0, 1, 2
        // But the store actually has sparse keys "0", "2", "4"
        // So when reconcile tries to apply changes, only indices 0 and 2 work
        (0, bun_test_1.expect)(result.change).toEqual({
            '0': 100, // This works (key "0" exists)
            '1': 200, // This fails (key "1" doesn't exist in sparse structure)
            '2': 300, // This works (key "2" exists)
        });
        (0, bun_test_1.expect)(result.add).toEqual({});
        (0, bun_test_1.expect)(result.remove).toEqual({});
        (0, bun_test_1.expect)(result.changed).toBe(true);
    });
    (0, bun_test_1.test)('should handle array-to-object conversion when context suggests sparse structure', function () {
        // This test demonstrates the core issue: we need context about the original structure
        // to properly handle sparse array replacement
        var oldSparseAsObject = { '0': 10, '2': 30, '4': 50 }; // Actual sparse structure
        var newDenseArray = [100, 200, 300]; // User input
        var result = (0, index_ts_1.diff)(oldSparseAsObject, newDenseArray);
        // This should remove old sparse keys and add new dense keys
        (0, bun_test_1.expect)(result.remove).toEqual({
            '4': index_ts_1.UNSET, // Key "4" should be removed (key "2" gets reused)
        });
        (0, bun_test_1.expect)(result.add).toEqual({
            '1': 200, // Key "1" should be added
        });
        (0, bun_test_1.expect)(result.change).toEqual({
            '0': 100, // Key "0" changes value from 10 to 100
            '2': 300, // Key "2" changes value from 30 to 300
        });
        (0, bun_test_1.expect)(result.changed).toBe(true);
    });
});
