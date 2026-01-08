"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_ts_1 = require("../index.ts");
/* === Tests === */
(0, bun_test_1.describe)('State', function () {
    (0, bun_test_1.describe)('State type guard', function () {
        (0, bun_test_1.test)('isState identifies state signals', function () {
            var count = new index_ts_1.State(42);
            (0, bun_test_1.expect)((0, index_ts_1.isState)(count)).toBe(true);
            (0, bun_test_1.expect)((0, index_ts_1.isComputed)(count)).toBe(false);
        });
    });
    (0, bun_test_1.describe)('Boolean cause', function () {
        (0, bun_test_1.test)('should be boolean', function () {
            var cause = new index_ts_1.State(false);
            (0, bun_test_1.expect)(typeof cause.get()).toBe('boolean');
        });
        (0, bun_test_1.test)('should set initial value to false', function () {
            var cause = new index_ts_1.State(false);
            (0, bun_test_1.expect)(cause.get()).toBe(false);
        });
        (0, bun_test_1.test)('should set initial value to true', function () {
            var cause = new index_ts_1.State(true);
            (0, bun_test_1.expect)(cause.get()).toBe(true);
        });
        (0, bun_test_1.test)('should set new value with .set(true)', function () {
            var cause = new index_ts_1.State(false);
            cause.set(true);
            (0, bun_test_1.expect)(cause.get()).toBe(true);
        });
        (0, bun_test_1.test)('should toggle initial value with .set(v => !v)', function () {
            var cause = new index_ts_1.State(false);
            cause.update(function (v) { return !v; });
            (0, bun_test_1.expect)(cause.get()).toBe(true);
        });
    });
    (0, bun_test_1.describe)('Number cause', function () {
        (0, bun_test_1.test)('should be number', function () {
            var cause = new index_ts_1.State(0);
            (0, bun_test_1.expect)(typeof cause.get()).toBe('number');
        });
        (0, bun_test_1.test)('should set initial value to 0', function () {
            var cause = new index_ts_1.State(0);
            (0, bun_test_1.expect)(cause.get()).toBe(0);
        });
        (0, bun_test_1.test)('should set new value with .set(42)', function () {
            var cause = new index_ts_1.State(0);
            cause.set(42);
            (0, bun_test_1.expect)(cause.get()).toBe(42);
        });
        (0, bun_test_1.test)('should increment value with .set(v => ++v)', function () {
            var cause = new index_ts_1.State(0);
            cause.update(function (v) { return ++v; });
            (0, bun_test_1.expect)(cause.get()).toBe(1);
        });
    });
    (0, bun_test_1.describe)('String cause', function () {
        (0, bun_test_1.test)('should be string', function () {
            var cause = new index_ts_1.State('foo');
            (0, bun_test_1.expect)(typeof cause.get()).toBe('string');
        });
        (0, bun_test_1.test)('should set initial value to "foo"', function () {
            var cause = new index_ts_1.State('foo');
            (0, bun_test_1.expect)(cause.get()).toBe('foo');
        });
        (0, bun_test_1.test)('should set new value with .set("bar")', function () {
            var cause = new index_ts_1.State('foo');
            cause.set('bar');
            (0, bun_test_1.expect)(cause.get()).toBe('bar');
        });
        (0, bun_test_1.test)('should upper case value with .set(v => v.toUpperCase())', function () {
            var cause = new index_ts_1.State('foo');
            cause.update(function (v) { return (v ? v.toUpperCase() : ''); });
            (0, bun_test_1.expect)(cause.get()).toBe('FOO');
        });
    });
    (0, bun_test_1.describe)('Array cause', function () {
        (0, bun_test_1.test)('should be array', function () {
            var cause = new index_ts_1.State([1, 2, 3]);
            (0, bun_test_1.expect)(Array.isArray(cause.get())).toBe(true);
        });
        (0, bun_test_1.test)('should set initial value to [1, 2, 3]', function () {
            var cause = new index_ts_1.State([1, 2, 3]);
            (0, bun_test_1.expect)(cause.get()).toEqual([1, 2, 3]);
        });
        (0, bun_test_1.test)('should set new value with .set([4, 5, 6])', function () {
            var cause = new index_ts_1.State([1, 2, 3]);
            cause.set([4, 5, 6]);
            (0, bun_test_1.expect)(cause.get()).toEqual([4, 5, 6]);
        });
        (0, bun_test_1.test)('should reflect current value of array after modification', function () {
            var array = [1, 2, 3];
            var cause = new index_ts_1.State(array);
            array.push(4); // don't do this! the result will be correct, but we can't trigger effects
            (0, bun_test_1.expect)(cause.get()).toEqual([1, 2, 3, 4]);
        });
        (0, bun_test_1.test)('should set new value with .set([...array, 4])', function () {
            var array = [1, 2, 3];
            var cause = new index_ts_1.State(array);
            cause.set(__spreadArray(__spreadArray([], array, true), [4], false)); // use destructuring instead!
            (0, bun_test_1.expect)(cause.get()).toEqual([1, 2, 3, 4]);
        });
        (0, bun_test_1.describe)('Input Validation', function () {
            (0, bun_test_1.test)('should throw NullishSignalValueError when initialValue is nullish', function () {
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    new index_ts_1.State(null);
                }).toThrow('Nullish signal values are not allowed in State');
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    new index_ts_1.State(undefined);
                }).toThrow('Nullish signal values are not allowed in State');
            });
            (0, bun_test_1.test)('should throw NullishSignalValueError when newValue is nullish in set()', function () {
                var state = new index_ts_1.State(42);
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    state.set(null);
                }).toThrow('Nullish signal values are not allowed in State');
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    state.set(undefined);
                }).toThrow('Nullish signal values are not allowed in State');
            });
            (0, bun_test_1.test)('should throw specific error types for nullish values', function () {
                try {
                    // @ts-expect-error - Testing invalid input
                    new index_ts_1.State(null);
                    (0, bun_test_1.expect)(true).toBe(false); // Should not reach here
                }
                catch (error) {
                    (0, bun_test_1.expect)(error).toBeInstanceOf(TypeError);
                    (0, bun_test_1.expect)(error.name).toBe('NullishSignalValueError');
                    (0, bun_test_1.expect)(error.message).toBe('Nullish signal values are not allowed in State');
                }
                var state = new index_ts_1.State(42);
                try {
                    // @ts-expect-error - Testing invalid input
                    state.set(null);
                    (0, bun_test_1.expect)(true).toBe(false); // Should not reach here
                }
                catch (error) {
                    (0, bun_test_1.expect)(error).toBeInstanceOf(TypeError);
                    (0, bun_test_1.expect)(error.name).toBe('NullishSignalValueError');
                    (0, bun_test_1.expect)(error.message).toBe('Nullish signal values are not allowed in State');
                }
            });
            (0, bun_test_1.test)('should allow valid non-nullish values', function () {
                // These should not throw
                (0, bun_test_1.expect)(function () {
                    new index_ts_1.State(0);
                }).not.toThrow();
                (0, bun_test_1.expect)(function () {
                    new index_ts_1.State('');
                }).not.toThrow();
                (0, bun_test_1.expect)(function () {
                    new index_ts_1.State(false);
                }).not.toThrow();
                (0, bun_test_1.expect)(function () {
                    new index_ts_1.State({});
                }).not.toThrow();
                (0, bun_test_1.expect)(function () {
                    new index_ts_1.State([]);
                }).not.toThrow();
                var state = new index_ts_1.State(42);
                (0, bun_test_1.expect)(function () {
                    state.set(0);
                }).not.toThrow();
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing valid input of invalid type
                    state.set('');
                }).not.toThrow();
            });
            (0, bun_test_1.test)('should throw InvalidCallbackError for non-function updater in update()', function () {
                var state = new index_ts_1.State(42);
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    state.update(null);
                }).toThrow('Invalid State update callback null');
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    state.update(undefined);
                }).toThrow('Invalid State update callback undefined');
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    state.update('not a function');
                }).toThrow('Invalid State update callback "not a function"');
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid input
                    state.update(42);
                }).toThrow('Invalid State update callback 42');
            });
            (0, bun_test_1.test)('should throw specific error type for non-function updater', function () {
                var state = new index_ts_1.State(42);
                try {
                    // @ts-expect-error - Testing invalid input
                    state.update(null);
                    (0, bun_test_1.expect)(true).toBe(false); // Should not reach here
                }
                catch (error) {
                    (0, bun_test_1.expect)(error).toBeInstanceOf(TypeError);
                    (0, bun_test_1.expect)(error.name).toBe('InvalidCallbackError');
                    (0, bun_test_1.expect)(error.message).toBe('Invalid State update callback null');
                }
            });
            (0, bun_test_1.test)('should handle updater function that throws an error', function () {
                var state = new index_ts_1.State(42);
                (0, bun_test_1.expect)(function () {
                    state.update(function () {
                        throw new Error('Updater error');
                    });
                }).toThrow('Updater error');
                // State should remain unchanged after error
                (0, bun_test_1.expect)(state.get()).toBe(42);
            });
            (0, bun_test_1.test)('should handle updater function that returns nullish value', function () {
                var state = new index_ts_1.State(42);
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid return value
                    state.update(function () { return null; });
                }).toThrow('Nullish signal values are not allowed in State');
                (0, bun_test_1.expect)(function () {
                    // @ts-expect-error - Testing invalid return value
                    state.update(function () { return undefined; });
                }).toThrow('Nullish signal values are not allowed in State');
                // State should remain unchanged after error
                (0, bun_test_1.expect)(state.get()).toBe(42);
            });
            (0, bun_test_1.test)('should handle valid updater functions', function () {
                var numberState = new index_ts_1.State(10);
                (0, bun_test_1.expect)(function () {
                    numberState.update(function (x) { return x + 5; });
                }).not.toThrow();
                (0, bun_test_1.expect)(numberState.get()).toBe(15);
                var stringState = new index_ts_1.State('hello');
                (0, bun_test_1.expect)(function () {
                    stringState.update(function (x) { return x.toUpperCase(); });
                }).not.toThrow();
                (0, bun_test_1.expect)(stringState.get()).toBe('HELLO');
                var arrayState = new index_ts_1.State([1, 2, 3]);
                (0, bun_test_1.expect)(function () {
                    arrayState.update(function (arr) { return __spreadArray(__spreadArray([], arr, true), [4], false); });
                }).not.toThrow();
                (0, bun_test_1.expect)(arrayState.get()).toEqual([1, 2, 3, 4]);
                var objectState = new index_ts_1.State({ count: 0 });
                (0, bun_test_1.expect)(function () {
                    objectState.update(function (obj) { return (__assign(__assign({}, obj), { count: obj.count + 1 })); });
                }).not.toThrow();
                (0, bun_test_1.expect)(objectState.get()).toEqual({ count: 1 });
            });
        });
    });
    (0, bun_test_1.describe)('Object cause', function () {
        (0, bun_test_1.test)('should be object', function () {
            var cause = new index_ts_1.State({ a: 'a', b: 1 });
            (0, bun_test_1.expect)(typeof cause.get()).toBe('object');
        });
        (0, bun_test_1.test)('should set initial value to { a: "a", b: 1 }', function () {
            var cause = new index_ts_1.State({ a: 'a', b: 1 });
            (0, bun_test_1.expect)(cause.get()).toEqual({ a: 'a', b: 1 });
        });
        (0, bun_test_1.test)('should set new value with .set({ c: true })', function () {
            var cause = new index_ts_1.State({ a: 'a', b: 1 });
            cause.set({ c: true });
            (0, bun_test_1.expect)(cause.get()).toEqual({ c: true });
        });
        (0, bun_test_1.test)('should reflect current value of object after modification', function () {
            var obj = { a: 'a', b: 1 };
            var cause = new index_ts_1.State(obj);
            // @ts-expect-error Property 'c' does not exist on type '{ a: string; b: number; }'. (ts 2339)
            obj.c = true; // don't do this! the result will be correct, but we can't trigger effects
            (0, bun_test_1.expect)(cause.get()).toEqual({ a: 'a', b: 1, c: true });
        });
        (0, bun_test_1.test)('should set new value with .set({...obj, c: true})', function () {
            var obj = { a: 'a', b: 1 };
            var cause = new index_ts_1.State(obj);
            cause.set(__assign(__assign({}, obj), { c: true })); // use destructuring instead!
            (0, bun_test_1.expect)(cause.get()).toEqual({ a: 'a', b: 1, c: true });
        });
    });
});
