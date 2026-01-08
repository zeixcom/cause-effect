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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
(0, bun_test_1.describe)('list', function () {
    (0, bun_test_1.describe)('creation and basic operations', function () {
        (0, bun_test_1.test)('creates lists with initial values', function () {
            var _a, _b, _c;
            var numbers = new index_ts_1.List([1, 2, 3]);
            (0, bun_test_1.expect)((_a = numbers.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(1);
            (0, bun_test_1.expect)((_b = numbers.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(2);
            (0, bun_test_1.expect)((_c = numbers.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(3);
        });
        (0, bun_test_1.test)('has Symbol.toStringTag of List', function () {
            var list = new index_ts_1.List([1, 2]);
            (0, bun_test_1.expect)(list[Symbol.toStringTag]).toBe('List');
        });
        (0, bun_test_1.test)('isList identifies list instances correctly', function () {
            var store = (0, index_ts_1.createStore)({ a: 1 });
            var list = new index_ts_1.List([1]);
            var state = new index_ts_1.State(1);
            var computed = new index_ts_1.Memo(function () { return 1; });
            (0, bun_test_1.expect)((0, index_ts_1.isList)(list)).toBe(true);
            (0, bun_test_1.expect)((0, index_ts_1.isStore)(store)).toBe(true);
            (0, bun_test_1.expect)((0, index_ts_1.isList)(state)).toBe(false);
            (0, bun_test_1.expect)((0, index_ts_1.isList)(computed)).toBe(false);
            (0, bun_test_1.expect)((0, index_ts_1.isList)({})).toBe(false);
        });
        (0, bun_test_1.test)('get() returns the complete list value', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            (0, bun_test_1.expect)(numbers.get()).toEqual([1, 2, 3]);
            // Nested structures
            var participants = new index_ts_1.List([
                { name: 'Alice', tags: ['admin'] },
                { name: 'Bob', tags: ['user'] },
            ]);
            (0, bun_test_1.expect)(participants.get()).toEqual([
                { name: 'Alice', tags: ['admin'] },
                { name: 'Bob', tags: ['user'] },
            ]);
        });
    });
    (0, bun_test_1.describe)('length property and sizing', function () {
        (0, bun_test_1.test)('length property works for lists', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            (0, bun_test_1.expect)(numbers.length).toBe(3);
            (0, bun_test_1.expect)(typeof numbers.length).toBe('number');
        });
        (0, bun_test_1.test)('length is reactive and updates with changes', function () {
            var items = new index_ts_1.List([1, 2]);
            (0, bun_test_1.expect)(items.length).toBe(2);
            items.add(3);
            (0, bun_test_1.expect)(items.length).toBe(3);
            items.remove(1);
            (0, bun_test_1.expect)(items.length).toBe(2);
        });
    });
    (0, bun_test_1.describe)('data access and modification', function () {
        (0, bun_test_1.test)('items can be accessed and modified via signals', function () {
            var _a, _b, _c, _d, _e, _f;
            var items = new index_ts_1.List(['a', 'b']);
            (0, bun_test_1.expect)((_a = items.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe('a');
            (0, bun_test_1.expect)((_b = items.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe('b');
            (_c = items.at(0)) === null || _c === void 0 ? void 0 : _c.set('alpha');
            (_d = items.at(1)) === null || _d === void 0 ? void 0 : _d.set('beta');
            (0, bun_test_1.expect)((_e = items.at(0)) === null || _e === void 0 ? void 0 : _e.get()).toBe('alpha');
            (0, bun_test_1.expect)((_f = items.at(1)) === null || _f === void 0 ? void 0 : _f.get()).toBe('beta');
        });
        (0, bun_test_1.test)('returns undefined for non-existent properties', function () {
            var items = new index_ts_1.List(['a']);
            (0, bun_test_1.expect)(items.at(5)).toBeUndefined();
        });
    });
    (0, bun_test_1.describe)('add() and remove() methods', function () {
        (0, bun_test_1.test)('add() method appends to end', function () {
            var _a;
            var fruits = new index_ts_1.List(['apple', 'banana']);
            fruits.add('cherry');
            (0, bun_test_1.expect)((_a = fruits.at(2)) === null || _a === void 0 ? void 0 : _a.get()).toBe('cherry');
        });
        (0, bun_test_1.test)('remove() method removes by index', function () {
            var items = new index_ts_1.List(['a', 'b', 'c']);
            items.remove(1); // Remove 'b'
            (0, bun_test_1.expect)(items.get()).toEqual(['a', 'c']);
            (0, bun_test_1.expect)(items.length).toBe(2);
        });
        (0, bun_test_1.test)('add method prevents null values', function () {
            var items = new index_ts_1.List([1]);
            // @ts-expect-error testing null values
            (0, bun_test_1.expect)(function () { return items.add(null); }).toThrow();
        });
        (0, bun_test_1.test)('remove method handles non-existent indices gracefully', function () {
            var items = new index_ts_1.List(['a']);
            (0, bun_test_1.expect)(function () { return items.remove(5); }).not.toThrow();
            (0, bun_test_1.expect)(items.get()).toEqual(['a']);
        });
    });
    (0, bun_test_1.describe)('sort() method', function () {
        (0, bun_test_1.test)('sorts lists with different compare functions', function () {
            var numbers = new index_ts_1.List([3, 1, 2]);
            numbers.sort();
            (0, bun_test_1.expect)(numbers.get()).toEqual([1, 2, 3]);
            numbers.sort(function (a, b) { return b - a; });
            (0, bun_test_1.expect)(numbers.get()).toEqual([3, 2, 1]);
            var names = new index_ts_1.List(['Charlie', 'Alice', 'Bob']);
            names.sort(function (a, b) { return a.localeCompare(b); });
            (0, bun_test_1.expect)(names.get()).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        (0, bun_test_1.test)('sort is reactive - watchers are notified', function () {
            var numbers = new index_ts_1.List([3, 1, 2]);
            var effectCount = 0;
            var lastValue = [];
            (0, index_ts_1.createEffect)(function () {
                lastValue = numbers.get();
                effectCount++;
            });
            (0, bun_test_1.expect)(effectCount).toBe(1);
            (0, bun_test_1.expect)(lastValue).toEqual([3, 1, 2]);
            numbers.sort();
            (0, bun_test_1.expect)(effectCount).toBe(2);
            (0, bun_test_1.expect)(lastValue).toEqual([1, 2, 3]);
        });
    });
    (0, bun_test_1.describe)('splice() method', function () {
        (0, bun_test_1.test)('splice() removes elements without adding new ones', function () {
            var numbers = new index_ts_1.List([1, 2, 3, 4]);
            var deleted = numbers.splice(1, 2);
            (0, bun_test_1.expect)(deleted).toEqual([2, 3]);
            (0, bun_test_1.expect)(numbers.get()).toEqual([1, 4]);
        });
        (0, bun_test_1.test)('splice() adds elements without removing any', function () {
            var numbers = new index_ts_1.List([1, 3]);
            var deleted = numbers.splice(1, 0, 2);
            (0, bun_test_1.expect)(deleted).toEqual([]);
            (0, bun_test_1.expect)(numbers.get()).toEqual([1, 2, 3]);
        });
        (0, bun_test_1.test)('splice() replaces elements (remove and add)', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var deleted = numbers.splice(1, 1, 4, 5);
            (0, bun_test_1.expect)(deleted).toEqual([2]);
            (0, bun_test_1.expect)(numbers.get()).toEqual([1, 4, 5, 3]);
        });
        (0, bun_test_1.test)('splice() handles negative start index', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var deleted = numbers.splice(-1, 1, 4);
            (0, bun_test_1.expect)(deleted).toEqual([3]);
            (0, bun_test_1.expect)(numbers.get()).toEqual([1, 2, 4]);
        });
    });
    (0, bun_test_1.describe)('reactivity', function () {
        (0, bun_test_1.test)('list-level get() is reactive', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var lastArray = [];
            (0, index_ts_1.createEffect)(function () {
                lastArray = numbers.get();
            });
            (0, bun_test_1.expect)(lastArray).toEqual([1, 2, 3]);
            numbers.add(4);
            (0, bun_test_1.expect)(lastArray).toEqual([1, 2, 3, 4]);
        });
        (0, bun_test_1.test)('individual signal reactivity works', function () {
            var _a;
            var items = new index_ts_1.List([{ count: 5 }]);
            var lastItem = 0;
            var itemEffectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                var _a, _b;
                lastItem = (_b = (_a = items.at(0)) === null || _a === void 0 ? void 0 : _a.get().count) !== null && _b !== void 0 ? _b : 0;
                itemEffectRuns++;
            });
            (0, bun_test_1.expect)(lastItem).toBe(5);
            (0, bun_test_1.expect)(itemEffectRuns).toBe(1);
            (_a = items.at(0)) === null || _a === void 0 ? void 0 : _a.set({ count: 10 });
            (0, bun_test_1.expect)(lastItem).toBe(10);
            (0, bun_test_1.expect)(itemEffectRuns).toBe(2);
        });
        (0, bun_test_1.test)('updates are reactive', function () {
            var numbers = new index_ts_1.List([1, 2]);
            var lastArray = [];
            var arrayEffectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                lastArray = numbers.get();
                arrayEffectRuns++;
            });
            (0, bun_test_1.expect)(lastArray).toEqual([1, 2]);
            (0, bun_test_1.expect)(arrayEffectRuns).toBe(1);
            numbers.update(function (arr) { return __spreadArray(__spreadArray([], arr, true), [3], false); });
            (0, bun_test_1.expect)(lastArray).toEqual([1, 2, 3]);
            (0, bun_test_1.expect)(arrayEffectRuns).toBe(2);
        });
    });
    (0, bun_test_1.describe)('computed integration', function () {
        (0, bun_test_1.test)('works with computed signals', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var sum = new index_ts_1.Memo(function () {
                return numbers.get().reduce(function (acc, n) { return acc + n; }, 0);
            });
            (0, bun_test_1.expect)(sum.get()).toBe(6);
            numbers.add(4);
            (0, bun_test_1.expect)(sum.get()).toBe(10);
        });
        (0, bun_test_1.test)('computed handles additions and removals', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var sum = new index_ts_1.Memo(function () {
                var array = numbers.get();
                return array.reduce(function (total, n) { return total + n; }, 0);
            });
            (0, bun_test_1.expect)(sum.get()).toBe(6);
            numbers.add(4);
            (0, bun_test_1.expect)(sum.get()).toBe(10);
            numbers.remove(0);
            var finalArray = numbers.get();
            (0, bun_test_1.expect)(finalArray).toEqual([2, 3, 4]);
            (0, bun_test_1.expect)(sum.get()).toBe(9);
        });
        (0, bun_test_1.test)('computed sum using list iteration with length tracking', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var sum = new index_ts_1.Memo(function () {
                // Access length to make it reactive
                var _length = numbers.length;
                var total = 0;
                for (var _i = 0, numbers_1 = numbers; _i < numbers_1.length; _i++) {
                    var signal = numbers_1[_i];
                    total += signal.get();
                }
                return total;
            });
            (0, bun_test_1.expect)(sum.get()).toBe(6);
            numbers.add(4);
            (0, bun_test_1.expect)(sum.get()).toBe(10);
        });
    });
    (0, bun_test_1.describe)('iteration and spreading', function () {
        (0, bun_test_1.test)('supports for...of iteration', function () {
            var numbers = new index_ts_1.List([10, 20, 30]);
            var signals = __spreadArray([], numbers, true);
            (0, bun_test_1.expect)(signals).toHaveLength(3);
            (0, bun_test_1.expect)(signals[0].get()).toBe(10);
            (0, bun_test_1.expect)(signals[1].get()).toBe(20);
            (0, bun_test_1.expect)(signals[2].get()).toBe(30);
        });
        (0, bun_test_1.test)('Symbol.isConcatSpreadable is true', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            (0, bun_test_1.expect)(numbers[Symbol.isConcatSpreadable]).toBe(true);
        });
    });
    (0, bun_test_1.describe)('edge cases', function () {
        (0, bun_test_1.test)('handles empty lists correctly', function () {
            var empty = new index_ts_1.List([]);
            (0, bun_test_1.expect)(empty.get()).toEqual([]);
            (0, bun_test_1.expect)(empty.length).toBe(0);
        });
        (0, bun_test_1.test)('handles UNSET values', function () {
            var list = new index_ts_1.List([index_ts_1.UNSET, 'valid']);
            (0, bun_test_1.expect)(list.get()).toEqual([index_ts_1.UNSET, 'valid']);
        });
        (0, bun_test_1.test)('handles primitive values', function () {
            var _a, _b, _c;
            var list = new index_ts_1.List([42, 'text', true]);
            (0, bun_test_1.expect)((_a = list.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(42);
            (0, bun_test_1.expect)((_b = list.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe('text');
            (0, bun_test_1.expect)((_c = list.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(true);
        });
    });
    (0, bun_test_1.describe)('deriveCollection() method', function () {
        (0, bun_test_1.describe)('synchronous transformations', function () {
            (0, bun_test_1.test)('transforms list values with sync callback', function () {
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = numbers.deriveCollection(function (value) { return value * 2; });
                (0, bun_test_1.expect)((0, index_ts_1.isCollection)(doubled)).toBe(true);
                (0, bun_test_1.expect)(doubled.length).toBe(3);
                (0, bun_test_1.expect)(doubled.get()).toEqual([2, 4, 6]);
            });
            (0, bun_test_1.test)('transforms object values with sync callback', function () {
                var users = new index_ts_1.List([
                    { name: 'Alice', age: 25 },
                    { name: 'Bob', age: 30 },
                ]);
                var userInfo = users.deriveCollection(function (user) { return ({
                    displayName: user.name.toUpperCase(),
                    isAdult: user.age >= 18,
                }); });
                (0, bun_test_1.expect)(userInfo.length).toBe(2);
                (0, bun_test_1.expect)(userInfo.get()).toEqual([
                    { displayName: 'ALICE', isAdult: true },
                    { displayName: 'BOB', isAdult: true },
                ]);
            });
            (0, bun_test_1.test)('transforms string values to different types', function () {
                var words = new index_ts_1.List(['hello', 'world', 'test']);
                var wordLengths = words.deriveCollection(function (word) { return ({
                    word: word,
                    length: word.length,
                }); });
                (0, bun_test_1.expect)(wordLengths.get()).toEqual([
                    { word: 'hello', length: 5 },
                    { word: 'world', length: 5 },
                    { word: 'test', length: 4 },
                ]);
            });
            (0, bun_test_1.test)('collection reactivity with sync transformations', function () {
                var _a;
                var numbers = new index_ts_1.List([1, 2]);
                var doubled = numbers.deriveCollection(function (value) { return value * 2; });
                var collectionValue = [];
                var effectRuns = 0;
                (0, index_ts_1.createEffect)(function () {
                    collectionValue = doubled.get();
                    effectRuns++;
                });
                (0, bun_test_1.expect)(collectionValue).toEqual([2, 4]);
                (0, bun_test_1.expect)(effectRuns).toBe(1);
                // Add new item
                numbers.add(3);
                (0, bun_test_1.expect)(collectionValue).toEqual([2, 4, 6]);
                (0, bun_test_1.expect)(effectRuns).toBe(2);
                // Modify existing item
                (_a = numbers.at(0)) === null || _a === void 0 ? void 0 : _a.set(5);
                (0, bun_test_1.expect)(collectionValue).toEqual([10, 4, 6]);
                (0, bun_test_1.expect)(effectRuns).toBe(3);
            });
            (0, bun_test_1.test)('collection responds to source removal', function () {
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = numbers.deriveCollection(function (value) { return value * 2; });
                (0, bun_test_1.expect)(doubled.get()).toEqual([2, 4, 6]);
                numbers.remove(1); // Remove middle item (2)
                (0, bun_test_1.expect)(doubled.get()).toEqual([2, 6]);
                (0, bun_test_1.expect)(doubled.length).toBe(2);
            });
        });
        (0, bun_test_1.describe)('asynchronous transformations', function () {
            (0, bun_test_1.test)('transforms values with async callback', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, asyncDoubled, initialLength, i;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            numbers = new index_ts_1.List([1, 2, 3]);
                            asyncDoubled = numbers.deriveCollection(function (value, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: 
                                        // Simulate async operation
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                        case 1:
                                            // Simulate async operation
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, value * 2];
                                    }
                                });
                            }); });
                            initialLength = asyncDoubled.length;
                            (0, bun_test_1.expect)(initialLength).toBe(3);
                            // Access each computed signal to trigger computation
                            for (i = 0; i < asyncDoubled.length; i++) {
                                (_a = asyncDoubled.at(i)) === null || _a === void 0 ? void 0 : _a.get();
                            }
                            // Allow async operations to complete
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                        case 1:
                            // Allow async operations to complete
                            _b.sent();
                            (0, bun_test_1.expect)(asyncDoubled.get()).toEqual([2, 4, 6]);
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, bun_test_1.test)('async collection with object transformation', function () { return __awaiter(void 0, void 0, void 0, function () {
                var users, enrichedUsers, i, result;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            users = new index_ts_1.List([
                                { id: 1, name: 'Alice' },
                                { id: 2, name: 'Bob' },
                            ]);
                            enrichedUsers = users.deriveCollection(function (user, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: 
                                        // Simulate API call
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                        case 1:
                                            // Simulate API call
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, __assign(__assign({}, user), { slug: user.name.toLowerCase(), timestamp: Date.now() })];
                                    }
                                });
                            }); });
                            // Trigger initial computation by accessing each computed signal
                            for (i = 0; i < enrichedUsers.length; i++) {
                                (_a = enrichedUsers.at(i)) === null || _a === void 0 ? void 0 : _a.get();
                            }
                            // Allow async operations to complete
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                        case 1:
                            // Allow async operations to complete
                            _b.sent();
                            result = enrichedUsers.get();
                            (0, bun_test_1.expect)(result).toHaveLength(2);
                            (0, bun_test_1.expect)(result[0].slug).toBe('alice');
                            (0, bun_test_1.expect)(result[1].slug).toBe('bob');
                            (0, bun_test_1.expect)(typeof result[0].timestamp).toBe('number');
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, bun_test_1.test)('async collection reactivity', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, asyncDoubled, effectValues;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            numbers = new index_ts_1.List([1, 2]);
                            asyncDoubled = numbers.deriveCollection(function (value, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5); })];
                                        case 1:
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, value * 2];
                                    }
                                });
                            }); });
                            effectValues = [];
                            // Set up effect to track changes reactively
                            (0, index_ts_1.createEffect)(function () {
                                var currentValue = asyncDoubled.get();
                                effectValues.push(__spreadArray([], currentValue, true));
                            });
                            // Allow initial computation
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 20); })];
                        case 1:
                            // Allow initial computation
                            _b.sent();
                            (0, bun_test_1.expect)(effectValues[effectValues.length - 1]).toEqual([2, 4]);
                            // Add new item
                            numbers.add(3);
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 20); })];
                        case 2:
                            _b.sent();
                            (0, bun_test_1.expect)(effectValues[effectValues.length - 1]).toEqual([2, 4, 6]);
                            // Modify existing item
                            (_a = numbers.at(0)) === null || _a === void 0 ? void 0 : _a.set(5);
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 20); })];
                        case 3:
                            _b.sent();
                            (0, bun_test_1.expect)(effectValues[effectValues.length - 1]).toEqual([
                                10, 4, 6,
                            ]);
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, bun_test_1.test)('handles AbortSignal cancellation', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, abortCalled, slowCollection;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            numbers = new index_ts_1.List([1]);
                            abortCalled = false;
                            slowCollection = numbers.deriveCollection(function (value, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, new Promise(function (resolve, reject) {
                                            var timeout = setTimeout(function () { return resolve(value * 2); }, 50);
                                            abort.addEventListener('abort', function () {
                                                clearTimeout(timeout);
                                                abortCalled = true;
                                                reject(new Error('Aborted'));
                                            });
                                        })];
                                });
                            }); });
                            // Trigger initial computation
                            (_a = slowCollection.at(0)) === null || _a === void 0 ? void 0 : _a.get();
                            // Change the value to trigger cancellation of the first computation
                            (_b = numbers.at(0)) === null || _b === void 0 ? void 0 : _b.set(2);
                            // Allow some time for operations
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                        case 1:
                            // Allow some time for operations
                            _c.sent();
                            (0, bun_test_1.expect)(abortCalled).toBe(true);
                            (0, bun_test_1.expect)(slowCollection.get()).toEqual([4]); // Last value (2 * 2)
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        (0, bun_test_1.describe)('derived collection chaining', function () {
            (0, bun_test_1.test)('chains multiple sync derivations', function () {
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = numbers.deriveCollection(function (value) { return value * 2; });
                var quadrupled = doubled.deriveCollection(function (value) { return value * 2; });
                (0, bun_test_1.expect)(quadrupled.get()).toEqual([4, 8, 12]);
                numbers.add(4);
                (0, bun_test_1.expect)(quadrupled.get()).toEqual([4, 8, 12, 16]);
            });
            (0, bun_test_1.test)('chains sync and async derivations', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, doubled, asyncSquared, i;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            numbers = new index_ts_1.List([1, 2]);
                            doubled = numbers.deriveCollection(function (value) { return value * 2; });
                            asyncSquared = doubled.deriveCollection(function (value, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                        case 1:
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, value * value];
                                    }
                                });
                            }); });
                            // Trigger initial computation by accessing each computed signal
                            for (i = 0; i < asyncSquared.length; i++) {
                                (_a = asyncSquared.at(i)) === null || _a === void 0 ? void 0 : _a.get();
                            }
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                        case 1:
                            _b.sent();
                            (0, bun_test_1.expect)(asyncSquared.get()).toEqual([4, 16]); // (1*2)^2, (2*2)^2
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        (0, bun_test_1.describe)('collection access methods', function () {
            (0, bun_test_1.test)('supports index-based access to computed signals', function () {
                var _a, _b, _c;
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = numbers.deriveCollection(function (value) { return value * 2; });
                (0, bun_test_1.expect)((_a = doubled.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(2);
                (0, bun_test_1.expect)((_b = doubled.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(4);
                (0, bun_test_1.expect)((_c = doubled.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(6);
                (0, bun_test_1.expect)(doubled.at(3)).toBeUndefined();
            });
            (0, bun_test_1.test)('supports key-based access', function () {
                var _a, _b;
                var numbers = new index_ts_1.List([10, 20]);
                var doubled = numbers.deriveCollection(function (value) { return value * 2; });
                var key0 = numbers.keyAt(0);
                var key1 = numbers.keyAt(1);
                (0, bun_test_1.expect)(key0).toBeDefined();
                (0, bun_test_1.expect)(key1).toBeDefined();
                if (key0 && key1) {
                    (0, bun_test_1.expect)((_a = doubled.byKey(key0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(20);
                    (0, bun_test_1.expect)((_b = doubled.byKey(key1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(40);
                }
            });
            (0, bun_test_1.test)('supports iteration', function () {
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = numbers.deriveCollection(function (value) { return value * 2; });
                var signals = __spreadArray([], doubled, true);
                (0, bun_test_1.expect)(signals).toHaveLength(3);
                (0, bun_test_1.expect)(signals[0].get()).toBe(2);
                (0, bun_test_1.expect)(signals[1].get()).toBe(4);
                (0, bun_test_1.expect)(signals[2].get()).toBe(6);
            });
        });
        (0, bun_test_1.describe)('edge cases', function () {
            (0, bun_test_1.test)('handles empty list derivation', function () {
                var empty = new index_ts_1.List([]);
                var doubled = empty.deriveCollection(function (value) { return value * 2; });
                (0, bun_test_1.expect)(doubled.get()).toEqual([]);
                (0, bun_test_1.expect)(doubled.length).toBe(0);
            });
            (0, bun_test_1.test)('handles UNSET values in transformation', function () {
                var list = new index_ts_1.List([1, index_ts_1.UNSET, 3]);
                var processed = list.deriveCollection(function (value) {
                    return value === index_ts_1.UNSET ? 0 : value * 2;
                });
                // UNSET values are filtered out before transformation
                (0, bun_test_1.expect)(processed.get()).toEqual([2, 6]);
            });
            (0, bun_test_1.test)('handles complex object transformations', function () {
                var items = new index_ts_1.List([
                    { id: 1, data: { value: 10, active: true } },
                    { id: 2, data: { value: 20, active: false } },
                ]);
                var transformed = items.deriveCollection(function (item) { return ({
                    itemId: item.id,
                    processedValue: item.data.value * 2,
                    status: item.data.active ? 'enabled' : 'disabled',
                }); });
                (0, bun_test_1.expect)(transformed.get()).toEqual([
                    { itemId: 1, processedValue: 20, status: 'enabled' },
                    { itemId: 2, processedValue: 40, status: 'disabled' },
                ]);
            });
        });
    });
    (0, bun_test_1.describe)('Watch Callbacks', function () {
        (0, bun_test_1.test)('List watched callback is called when effect accesses list.get()', function () {
            var listHookWatchCalled = false;
            var listUnwatchCalled = false;
            var numbers = new index_ts_1.List([10, 20, 30], {
                watched: function () {
                    listHookWatchCalled = true;
                },
                unwatched: function () {
                    listUnwatchCalled = true;
                },
            });
            (0, bun_test_1.expect)(listHookWatchCalled).toBe(false);
            // Access list via list.get() - this should trigger list's watched callback
            var effectValue = [];
            var cleanup = (0, index_ts_1.createEffect)(function () {
                effectValue = numbers.get();
            });
            (0, bun_test_1.expect)(listHookWatchCalled).toBe(true);
            (0, bun_test_1.expect)(effectValue).toEqual([10, 20, 30]);
            (0, bun_test_1.expect)(listUnwatchCalled).toBe(false);
            // Cleanup effect - should trigger unwatch
            cleanup();
            (0, bun_test_1.expect)(listUnwatchCalled).toBe(true);
        });
        (0, bun_test_1.test)('List length access triggers List watched callback', function () {
            var listHookWatchCalled = false;
            var listUnwatchCalled = false;
            var numbers = new index_ts_1.List([1, 2, 3], {
                watched: function () {
                    listHookWatchCalled = true;
                },
                unwatched: function () {
                    listUnwatchCalled = true;
                },
            });
            // Access via list.length - this should trigger list's watched callback
            var effectValue = 0;
            var cleanup = (0, index_ts_1.createEffect)(function () {
                effectValue = numbers.length;
            });
            (0, bun_test_1.expect)(listHookWatchCalled).toBe(true);
            (0, bun_test_1.expect)(effectValue).toBe(3);
            (0, bun_test_1.expect)(listUnwatchCalled).toBe(false);
            cleanup();
            (0, bun_test_1.expect)(listUnwatchCalled).toBe(true);
        });
    });
});
