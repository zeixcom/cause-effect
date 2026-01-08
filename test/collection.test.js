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
(0, bun_test_1.describe)('collection', function () {
    (0, bun_test_1.describe)('creation and basic operations', function () {
        (0, bun_test_1.test)('creates collection with initial values from list', function () {
            var _a, _b, _c;
            var numbers = new index_ts_1.List([1, 2, 3]);
            var doubled = new index_ts_1.DerivedCollection(numbers, function (value) { return value * 2; });
            (0, bun_test_1.expect)(doubled.length).toBe(3);
            (0, bun_test_1.expect)((_a = doubled.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(2);
            (0, bun_test_1.expect)((_b = doubled.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(4);
            (0, bun_test_1.expect)((_c = doubled.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(6);
        });
        (0, bun_test_1.test)('creates collection from function source', function () {
            var _a, _b, _c;
            var doubled = new index_ts_1.DerivedCollection(function () { return new index_ts_1.List([10, 20, 30]); }, function (value) { return value * 2; });
            (0, bun_test_1.expect)(doubled.length).toBe(3);
            (0, bun_test_1.expect)((_a = doubled.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(20);
            (0, bun_test_1.expect)((_b = doubled.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(40);
            (0, bun_test_1.expect)((_c = doubled.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(60);
        });
        (0, bun_test_1.test)('has Symbol.toStringTag of Collection', function () {
            var list = new index_ts_1.List([1, 2, 3]);
            var collection = new index_ts_1.DerivedCollection(list, function (x) { return x; });
            (0, bun_test_1.expect)(Object.prototype.toString.call(collection)).toBe('[object Collection]');
        });
        (0, bun_test_1.test)('isCollection identifies collection instances correctly', function () {
            var store = (0, index_ts_1.createStore)({ a: 1 });
            var list = new index_ts_1.List([1, 2, 3]);
            var collection = new index_ts_1.DerivedCollection(list, function (x) { return x; });
            (0, bun_test_1.expect)((0, index_ts_1.isCollection)(collection)).toBe(true);
            (0, bun_test_1.expect)((0, index_ts_1.isCollection)(list)).toBe(false);
            (0, bun_test_1.expect)((0, index_ts_1.isCollection)(store)).toBe(false);
            (0, bun_test_1.expect)((0, index_ts_1.isCollection)({})).toBe(false);
            (0, bun_test_1.expect)((0, index_ts_1.isCollection)(null)).toBe(false);
        });
        (0, bun_test_1.test)('get() returns the complete collection value', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var doubled = new index_ts_1.DerivedCollection(numbers, function (value) { return value * 2; });
            var result = doubled.get();
            (0, bun_test_1.expect)(result).toEqual([2, 4, 6]);
            (0, bun_test_1.expect)(Array.isArray(result)).toBe(true);
        });
    });
    (0, bun_test_1.describe)('length property and sizing', function () {
        (0, bun_test_1.test)('length property works for collections', function () {
            var numbers = new index_ts_1.List([1, 2, 3, 4, 5]);
            var collection = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
            (0, bun_test_1.expect)(collection.length).toBe(5);
        });
        (0, bun_test_1.test)('length is reactive and updates with changes', function () {
            var items = new index_ts_1.List([1, 2]);
            var collection = new index_ts_1.DerivedCollection(items, function (x) { return x * 2; });
            (0, bun_test_1.expect)(collection.length).toBe(2);
            items.add(3);
            (0, bun_test_1.expect)(collection.length).toBe(3);
        });
    });
    (0, bun_test_1.describe)('index-based access', function () {
        (0, bun_test_1.test)('properties can be accessed via computed signals', function () {
            var _a, _b, _c;
            var items = new index_ts_1.List([10, 20, 30]);
            var doubled = new index_ts_1.DerivedCollection(items, function (x) { return x * 2; });
            (0, bun_test_1.expect)((_a = doubled.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(20);
            (0, bun_test_1.expect)((_b = doubled.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(40);
            (0, bun_test_1.expect)((_c = doubled.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(60);
        });
        (0, bun_test_1.test)('returns undefined for non-existent properties', function () {
            var items = new index_ts_1.List([1, 2]);
            var collection = new index_ts_1.DerivedCollection(items, function (x) { return x; });
            (0, bun_test_1.expect)(collection.at(5)).toBeUndefined();
        });
        (0, bun_test_1.test)('supports numeric key access', function () {
            var _a;
            var numbers = new index_ts_1.List([1, 2, 3]);
            var collection = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
            (0, bun_test_1.expect)((_a = collection.at(1)) === null || _a === void 0 ? void 0 : _a.get()).toBe(4);
        });
    });
    (0, bun_test_1.describe)('key-based access methods', function () {
        (0, bun_test_1.test)('byKey() returns computed signal for existing keys', function () {
            var _a, _b;
            var numbers = new index_ts_1.List([1, 2, 3]);
            var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
            var key0 = numbers.keyAt(0);
            var key1 = numbers.keyAt(1);
            (0, bun_test_1.expect)(key0).toBeDefined();
            (0, bun_test_1.expect)(key1).toBeDefined();
            // biome-ignore lint/style/noNonNullAssertion: test
            (0, bun_test_1.expect)(doubled.byKey(key0)).toBeDefined();
            // biome-ignore lint/style/noNonNullAssertion: test
            (0, bun_test_1.expect)(doubled.byKey(key1)).toBeDefined();
            // biome-ignore lint/style/noNonNullAssertion: test
            (0, bun_test_1.expect)((_a = doubled.byKey(key0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(2);
            // biome-ignore lint/style/noNonNullAssertion: test
            (0, bun_test_1.expect)((_b = doubled.byKey(key1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(4);
        });
        (0, bun_test_1.test)('keyAt() and indexOfKey() work correctly', function () {
            var numbers = new index_ts_1.List([5, 10, 15]);
            var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
            var key0 = doubled.keyAt(0);
            var key1 = doubled.keyAt(1);
            (0, bun_test_1.expect)(key0).toBeDefined();
            (0, bun_test_1.expect)(key1).toBeDefined();
            // biome-ignore lint/style/noNonNullAssertion: test
            (0, bun_test_1.expect)(doubled.indexOfKey(key0)).toBe(0);
            // biome-ignore lint/style/noNonNullAssertion: test
            (0, bun_test_1.expect)(doubled.indexOfKey(key1)).toBe(1);
        });
    });
    (0, bun_test_1.describe)('reactivity', function () {
        (0, bun_test_1.test)('collection-level get() is reactive', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
            var lastArray = [];
            (0, index_ts_1.createEffect)(function () {
                lastArray = doubled.get();
            });
            (0, bun_test_1.expect)(lastArray).toEqual([2, 4, 6]);
            numbers.add(4);
            (0, bun_test_1.expect)(lastArray).toEqual([2, 4, 6, 8]);
        });
        (0, bun_test_1.test)('individual signal reactivity works', function () {
            var _a;
            var items = new index_ts_1.List([{ count: 1 }, { count: 2 }]);
            var doubled = new index_ts_1.DerivedCollection(items, function (item) { return ({ count: item.count * 2 }); });
            var lastItem;
            var itemEffectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                var _a;
                lastItem = (_a = doubled.at(0)) === null || _a === void 0 ? void 0 : _a.get();
                itemEffectRuns++;
            });
            (0, bun_test_1.expect)(lastItem).toEqual({ count: 2 });
            (0, bun_test_1.expect)(itemEffectRuns).toBe(1);
            (_a = items.at(0)) === null || _a === void 0 ? void 0 : _a.set({ count: 5 });
            (0, bun_test_1.expect)(lastItem).toEqual({ count: 10 });
            // Effect runs twice: once initially, once for change
            (0, bun_test_1.expect)(itemEffectRuns).toEqual(2);
        });
        (0, bun_test_1.test)('updates are reactive', function () {
            var _a;
            var numbers = new index_ts_1.List([1, 2, 3]);
            var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
            var lastArray = [];
            var arrayEffectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                lastArray = doubled.get();
                arrayEffectRuns++;
            });
            (0, bun_test_1.expect)(lastArray).toEqual([2, 4, 6]);
            (0, bun_test_1.expect)(arrayEffectRuns).toBe(1);
            (_a = numbers.at(1)) === null || _a === void 0 ? void 0 : _a.set(10);
            (0, bun_test_1.expect)(lastArray).toEqual([2, 20, 6]);
            (0, bun_test_1.expect)(arrayEffectRuns).toBe(2);
        });
    });
    (0, bun_test_1.describe)('iteration and spreading', function () {
        (0, bun_test_1.test)('supports for...of iteration', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
            var signals = __spreadArray([], doubled, true);
            (0, bun_test_1.expect)(signals).toHaveLength(3);
            (0, bun_test_1.expect)(signals[0].get()).toBe(2);
            (0, bun_test_1.expect)(signals[1].get()).toBe(4);
            (0, bun_test_1.expect)(signals[2].get()).toBe(6);
        });
        (0, bun_test_1.test)('Symbol.isConcatSpreadable is true', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var collection = new index_ts_1.DerivedCollection(numbers, function (x) { return x; });
            (0, bun_test_1.expect)(collection[Symbol.isConcatSpreadable]).toBe(true);
        });
    });
    (0, bun_test_1.describe)('edge cases', function () {
        (0, bun_test_1.test)('handles empty collections correctly', function () {
            var empty = new index_ts_1.List([]);
            var collection = new index_ts_1.DerivedCollection(empty, function (x) { return x * 2; });
            (0, bun_test_1.expect)(collection.length).toBe(0);
            (0, bun_test_1.expect)(collection.get()).toEqual([]);
        });
        (0, bun_test_1.test)('handles UNSET values', function () {
            var list = new index_ts_1.List([1, 2, 3]);
            var processed = new index_ts_1.DerivedCollection(list, function (x) {
                return x > 2 ? x : index_ts_1.UNSET;
            });
            // UNSET values should be filtered out
            (0, bun_test_1.expect)(processed.get()).toEqual([3]);
        });
        (0, bun_test_1.test)('handles primitive values', function () {
            var _a, _b;
            var list = new index_ts_1.List(['hello', 'world']);
            var lengths = new index_ts_1.DerivedCollection(list, function (str) { return ({
                length: str.length,
            }); });
            (0, bun_test_1.expect)((_a = lengths.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toEqual({ length: 5 });
            (0, bun_test_1.expect)((_b = lengths.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toEqual({ length: 5 });
        });
    });
    (0, bun_test_1.describe)('deriveCollection() method', function () {
        (0, bun_test_1.describe)('synchronous transformations', function () {
            (0, bun_test_1.test)('transforms collection values with sync callback', function () {
                var _a, _b, _c;
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                var quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                (0, bun_test_1.expect)(quadrupled.length).toBe(3);
                (0, bun_test_1.expect)((_a = quadrupled.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(4);
                (0, bun_test_1.expect)((_b = quadrupled.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(8);
                (0, bun_test_1.expect)((_c = quadrupled.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(12);
            });
            (0, bun_test_1.test)('transforms object values with sync callback', function () {
                var _a, _b;
                var users = new index_ts_1.List([
                    { name: 'Alice', age: 25 },
                    { name: 'Bob', age: 30 },
                ]);
                var basicInfo = new index_ts_1.DerivedCollection(users, function (user) { return ({
                    displayName: user.name.toUpperCase(),
                    isAdult: user.age >= 18,
                }); });
                var detailedInfo = basicInfo.deriveCollection(function (info) { return (__assign(__assign({}, info), { category: info.isAdult ? 'adult' : 'minor' })); });
                (0, bun_test_1.expect)((_a = detailedInfo.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toEqual({
                    displayName: 'ALICE',
                    isAdult: true,
                    category: 'adult',
                });
                (0, bun_test_1.expect)((_b = detailedInfo.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toEqual({
                    displayName: 'BOB',
                    isAdult: true,
                    category: 'adult',
                });
            });
            (0, bun_test_1.test)('transforms string values to different types', function () {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                var words = new index_ts_1.List(['hello', 'world', 'test']);
                var wordInfo = new index_ts_1.DerivedCollection(words, function (word) { return ({
                    word: word,
                    length: word.length,
                }); });
                var analysis = wordInfo.deriveCollection(function (info) { return (__assign(__assign({}, info), { isLong: info.length > 4 })); });
                (0, bun_test_1.expect)((_a = analysis.at(0)) === null || _a === void 0 ? void 0 : _a.get().word).toBe('hello');
                (0, bun_test_1.expect)((_b = analysis.at(0)) === null || _b === void 0 ? void 0 : _b.get().length).toBe(5);
                (0, bun_test_1.expect)((_c = analysis.at(0)) === null || _c === void 0 ? void 0 : _c.get().isLong).toBe(true);
                (0, bun_test_1.expect)((_d = analysis.at(1)) === null || _d === void 0 ? void 0 : _d.get().word).toBe('world');
                (0, bun_test_1.expect)((_e = analysis.at(1)) === null || _e === void 0 ? void 0 : _e.get().length).toBe(5);
                (0, bun_test_1.expect)((_f = analysis.at(1)) === null || _f === void 0 ? void 0 : _f.get().isLong).toBe(true);
                (0, bun_test_1.expect)((_g = analysis.at(2)) === null || _g === void 0 ? void 0 : _g.get().word).toBe('test');
                (0, bun_test_1.expect)((_h = analysis.at(2)) === null || _h === void 0 ? void 0 : _h.get().length).toBe(4);
                (0, bun_test_1.expect)((_j = analysis.at(2)) === null || _j === void 0 ? void 0 : _j.get().isLong).toBe(false);
            });
            (0, bun_test_1.test)('derived collection reactivity with sync transformations', function () {
                var _a;
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                var quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                var collectionValue = [];
                var effectRuns = 0;
                (0, index_ts_1.createEffect)(function () {
                    collectionValue = quadrupled.get();
                    effectRuns++;
                });
                (0, bun_test_1.expect)(collectionValue).toEqual([4, 8, 12]);
                (0, bun_test_1.expect)(effectRuns).toBe(1);
                numbers.add(4);
                (0, bun_test_1.expect)(collectionValue).toEqual([4, 8, 12, 16]);
                (0, bun_test_1.expect)(effectRuns).toBe(2);
                (_a = numbers.at(1)) === null || _a === void 0 ? void 0 : _a.set(5);
                (0, bun_test_1.expect)(collectionValue).toEqual([4, 20, 12, 16]);
                (0, bun_test_1.expect)(effectRuns).toBe(3);
            });
            (0, bun_test_1.test)('derived collection responds to source removal', function () {
                var numbers = new index_ts_1.List([1, 2, 3, 4]);
                var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                var quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                (0, bun_test_1.expect)(quadrupled.get()).toEqual([4, 8, 12, 16]);
                numbers.remove(1);
                (0, bun_test_1.expect)(quadrupled.get()).toEqual([4, 12, 16]);
            });
        });
        (0, bun_test_1.describe)('asynchronous transformations', function () {
            (0, bun_test_1.test)('transforms values with async callback', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, doubled, asyncQuadrupled, initialLength, results, effectRuns;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            numbers = new index_ts_1.List([1, 2, 3]);
                            doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                            asyncQuadrupled = doubled.deriveCollection(function (x, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                        case 1:
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, x * 2];
                                    }
                                });
                            }); });
                            initialLength = asyncQuadrupled.length;
                            (0, bun_test_1.expect)(initialLength).toBe(3);
                            // Initially, async computations return UNSET
                            (0, bun_test_1.expect)(asyncQuadrupled.at(0)).toBeDefined();
                            (0, bun_test_1.expect)(asyncQuadrupled.at(1)).toBeDefined();
                            (0, bun_test_1.expect)(asyncQuadrupled.at(2)).toBeDefined();
                            results = [];
                            effectRuns = 0;
                            (0, index_ts_1.createEffect)(function () {
                                var values = asyncQuadrupled.get();
                                results.push.apply(results, values);
                                effectRuns++;
                            });
                            // Wait for async computations to complete
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })
                                // Should have received the computed values
                            ];
                        case 1:
                            // Wait for async computations to complete
                            _a.sent();
                            // Should have received the computed values
                            (0, bun_test_1.expect)(results.slice(-3)).toEqual([4, 8, 12]);
                            (0, bun_test_1.expect)(effectRuns).toBeGreaterThanOrEqual(1);
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, bun_test_1.test)('async derived collection with object transformation', function () { return __awaiter(void 0, void 0, void 0, function () {
                var users, basicInfo, enrichedUsers, enrichedResults, result1, result2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            users = new index_ts_1.List([
                                { id: 1, name: 'Alice' },
                                { id: 2, name: 'Bob' },
                            ]);
                            basicInfo = new index_ts_1.DerivedCollection(users, function (user) { return ({
                                userId: user.id,
                                displayName: user.name.toUpperCase(),
                            }); });
                            enrichedUsers = basicInfo.deriveCollection(function (info, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: 
                                        // Simulate async enrichment
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                        case 1:
                                            // Simulate async enrichment
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, __assign(__assign({}, info), { slug: info.displayName
                                                        .toLowerCase()
                                                        .replace(/\s+/g, '-'), timestamp: Date.now() })];
                                    }
                                });
                            }); });
                            enrichedResults = [];
                            (0, index_ts_1.createEffect)(function () {
                                enrichedResults = enrichedUsers.get();
                            });
                            // Wait for async computations to complete
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                        case 1:
                            // Wait for async computations to complete
                            _a.sent();
                            (0, bun_test_1.expect)(enrichedResults).toHaveLength(2);
                            result1 = enrichedResults[0], result2 = enrichedResults[1];
                            (0, bun_test_1.expect)(result1 === null || result1 === void 0 ? void 0 : result1.userId).toBe(1);
                            (0, bun_test_1.expect)(result1 === null || result1 === void 0 ? void 0 : result1.displayName).toBe('ALICE');
                            (0, bun_test_1.expect)(result1 === null || result1 === void 0 ? void 0 : result1.slug).toBe('alice');
                            (0, bun_test_1.expect)(typeof (result1 === null || result1 === void 0 ? void 0 : result1.timestamp)).toBe('number');
                            (0, bun_test_1.expect)(result2 === null || result2 === void 0 ? void 0 : result2.userId).toBe(2);
                            (0, bun_test_1.expect)(result2 === null || result2 === void 0 ? void 0 : result2.displayName).toBe('BOB');
                            (0, bun_test_1.expect)(result2 === null || result2 === void 0 ? void 0 : result2.slug).toBe('bob');
                            (0, bun_test_1.expect)(typeof (result2 === null || result2 === void 0 ? void 0 : result2.timestamp)).toBe('number');
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, bun_test_1.test)('async derived collection reactivity', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, doubled, asyncQuadrupled, effectValues, lastValue;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            numbers = new index_ts_1.List([1, 2, 3]);
                            doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                            asyncQuadrupled = doubled.deriveCollection(function (x, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                        case 1:
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, x * 2];
                                    }
                                });
                            }); });
                            effectValues = [];
                            (0, index_ts_1.createEffect)(function () {
                                // Access all values to trigger reactive behavior
                                var currentValue = asyncQuadrupled.get();
                                effectValues.push(currentValue);
                            });
                            // Wait for initial effect
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })
                                // Initial empty array (async values not resolved yet)
                            ];
                        case 1:
                            // Wait for initial effect
                            _d.sent();
                            // Initial empty array (async values not resolved yet)
                            (0, bun_test_1.expect)(effectValues[0]).toEqual([]);
                            // Trigger individual computations
                            (_a = asyncQuadrupled.at(0)) === null || _a === void 0 ? void 0 : _a.get();
                            (_b = asyncQuadrupled.at(1)) === null || _b === void 0 ? void 0 : _b.get();
                            (_c = asyncQuadrupled.at(2)) === null || _c === void 0 ? void 0 : _c.get();
                            // Wait for effects to process
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })
                                // Should have the computed values now
                            ];
                        case 2:
                            // Wait for effects to process
                            _d.sent();
                            lastValue = effectValues[effectValues.length - 1];
                            (0, bun_test_1.expect)(lastValue).toEqual([4, 8, 12]);
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, bun_test_1.test)('handles AbortSignal cancellation', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, doubled, abortCalled, slowCollection, _awaited;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            numbers = new index_ts_1.List([1, 2, 3]);
                            doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                            abortCalled = false;
                            slowCollection = doubled.deriveCollection(function (x, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                var timeout;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            abort.addEventListener('abort', function () {
                                                abortCalled = true;
                                            });
                                            timeout = new Promise(function (resolve) {
                                                return setTimeout(resolve, 100);
                                            });
                                            return [4 /*yield*/, timeout];
                                        case 1:
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, x * 2];
                                    }
                                });
                            }); });
                            _awaited = (_a = slowCollection.at(0)) === null || _a === void 0 ? void 0 : _a.get();
                            // Change source to trigger cancellation
                            (_b = numbers.at(0)) === null || _b === void 0 ? void 0 : _b.set(10);
                            // Wait for potential abort
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                        case 1:
                            // Wait for potential abort
                            _c.sent();
                            (0, bun_test_1.expect)(abortCalled).toBe(true);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        (0, bun_test_1.describe)('derived collection chaining', function () {
            (0, bun_test_1.test)('chains multiple sync derivations', function () {
                var _a, _b, _c;
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                var quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                var octupled = quadrupled.deriveCollection(function (x) { return x * 2; });
                (0, bun_test_1.expect)((_a = octupled.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(8);
                (0, bun_test_1.expect)((_b = octupled.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(16);
                (0, bun_test_1.expect)((_c = octupled.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(24);
            });
            (0, bun_test_1.test)('chains sync and async derivations', function () { return __awaiter(void 0, void 0, void 0, function () {
                var numbers, doubled, quadrupled, asyncOctupled, chainedResults;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            numbers = new index_ts_1.List([1, 2, 3]);
                            doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                            quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                            asyncOctupled = quadrupled.deriveCollection(function (x, abort) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                        case 1:
                                            _a.sent();
                                            if (abort.aborted)
                                                throw new Error('Aborted');
                                            return [2 /*return*/, x * 2];
                                    }
                                });
                            }); });
                            chainedResults = [];
                            (0, index_ts_1.createEffect)(function () {
                                chainedResults = asyncOctupled.get();
                            });
                            // Wait for async computations to complete
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                        case 1:
                            // Wait for async computations to complete
                            _a.sent();
                            (0, bun_test_1.expect)(chainedResults).toEqual([8, 16, 24]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        (0, bun_test_1.describe)('derived collection access methods', function () {
            (0, bun_test_1.test)('provides index-based access to computed signals', function () {
                var _a, _b, _c;
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                var quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                (0, bun_test_1.expect)((_a = quadrupled.at(0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(4);
                (0, bun_test_1.expect)((_b = quadrupled.at(1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(8);
                (0, bun_test_1.expect)((_c = quadrupled.at(2)) === null || _c === void 0 ? void 0 : _c.get()).toBe(12);
                (0, bun_test_1.expect)(quadrupled.at(10)).toBeUndefined();
            });
            (0, bun_test_1.test)('supports key-based access', function () {
                var _a, _b;
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                var quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                var key0 = quadrupled.keyAt(0);
                var key1 = quadrupled.keyAt(1);
                (0, bun_test_1.expect)(key0).toBeDefined();
                (0, bun_test_1.expect)(key1).toBeDefined();
                // biome-ignore lint/style/noNonNullAssertion: test
                (0, bun_test_1.expect)(quadrupled.byKey(key0)).toBeDefined();
                // biome-ignore lint/style/noNonNullAssertion: test
                (0, bun_test_1.expect)(quadrupled.byKey(key1)).toBeDefined();
                // biome-ignore lint/style/noNonNullAssertion: test
                (0, bun_test_1.expect)((_a = quadrupled.byKey(key0)) === null || _a === void 0 ? void 0 : _a.get()).toBe(4);
                // biome-ignore lint/style/noNonNullAssertion: test
                (0, bun_test_1.expect)((_b = quadrupled.byKey(key1)) === null || _b === void 0 ? void 0 : _b.get()).toBe(8);
            });
            (0, bun_test_1.test)('supports iteration', function () {
                var numbers = new index_ts_1.List([1, 2, 3]);
                var doubled = new index_ts_1.DerivedCollection(numbers, function (x) { return x * 2; });
                var quadrupled = doubled.deriveCollection(function (x) { return x * 2; });
                var signals = __spreadArray([], quadrupled, true);
                (0, bun_test_1.expect)(signals).toHaveLength(3);
                (0, bun_test_1.expect)(signals[0].get()).toBe(4);
                (0, bun_test_1.expect)(signals[1].get()).toBe(8);
                (0, bun_test_1.expect)(signals[2].get()).toBe(12);
            });
        });
        (0, bun_test_1.describe)('edge cases', function () {
            (0, bun_test_1.test)('handles empty collection derivation', function () {
                var empty = new index_ts_1.List([]);
                var emptyCollection = new index_ts_1.DerivedCollection(empty, function (x) { return x * 2; });
                var derived = emptyCollection.deriveCollection(function (x) { return x * 2; });
                (0, bun_test_1.expect)(derived.length).toBe(0);
                (0, bun_test_1.expect)(derived.get()).toEqual([]);
            });
            (0, bun_test_1.test)('handles UNSET values in transformation', function () {
                var list = new index_ts_1.List([1, 2, 3]);
                var filtered = new index_ts_1.DerivedCollection(list, function (x) {
                    return x > 1 ? { value: x } : index_ts_1.UNSET;
                });
                var doubled = filtered.deriveCollection(function (x) { return ({ value: x.value * 2 }); });
                (0, bun_test_1.expect)(doubled.get()).toEqual([{ value: 4 }, { value: 6 }]);
            });
            (0, bun_test_1.test)('handles complex object transformations', function () {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                var items = new index_ts_1.List([
                    { id: 1, data: { value: 10, active: true } },
                    { id: 2, data: { value: 20, active: false } },
                ]);
                var processed = new index_ts_1.DerivedCollection(items, function (item) { return ({
                    itemId: item.id,
                    processedValue: item.data.value * 2,
                    status: item.data.active ? 'active' : 'inactive',
                }); });
                var enhanced = processed.deriveCollection(function (item) { return (__assign(__assign({}, item), { category: item.processedValue > 15 ? 'high' : 'low' })); });
                (0, bun_test_1.expect)((_a = enhanced.at(0)) === null || _a === void 0 ? void 0 : _a.get().itemId).toBe(1);
                (0, bun_test_1.expect)((_b = enhanced.at(0)) === null || _b === void 0 ? void 0 : _b.get().processedValue).toBe(20);
                (0, bun_test_1.expect)((_c = enhanced.at(0)) === null || _c === void 0 ? void 0 : _c.get().status).toBe('active');
                (0, bun_test_1.expect)((_d = enhanced.at(0)) === null || _d === void 0 ? void 0 : _d.get().category).toBe('high');
                (0, bun_test_1.expect)((_e = enhanced.at(1)) === null || _e === void 0 ? void 0 : _e.get().itemId).toBe(2);
                (0, bun_test_1.expect)((_f = enhanced.at(1)) === null || _f === void 0 ? void 0 : _f.get().processedValue).toBe(40);
                (0, bun_test_1.expect)((_g = enhanced.at(1)) === null || _g === void 0 ? void 0 : _g.get().status).toBe('inactive');
                (0, bun_test_1.expect)((_h = enhanced.at(1)) === null || _h === void 0 ? void 0 : _h.get().category).toBe('high');
            });
        });
    });
    (0, bun_test_1.describe)('Watch Callbacks', function () {
        (0, bun_test_1.test)('Collection watched callback is called when effect accesses collection.get()', function () {
            var numbers = new index_ts_1.List([10, 20, 30]);
            var collectionWatchedCalled = false;
            var collectionUnwatchCalled = false;
            var doubled = numbers.deriveCollection(function (x) { return x * 2; }, {
                watched: function () {
                    collectionWatchedCalled = true;
                },
                unwatched: function () {
                    collectionUnwatchCalled = true;
                },
            });
            (0, bun_test_1.expect)(collectionWatchedCalled).toBe(false);
            // Access collection via collection.get() - this should trigger collection's watched callback
            var effectValue = [];
            var cleanup = (0, index_ts_1.createEffect)(function () {
                effectValue = doubled.get();
            });
            (0, bun_test_1.expect)(collectionWatchedCalled).toBe(true);
            (0, bun_test_1.expect)(effectValue).toEqual([20, 40, 60]);
            (0, bun_test_1.expect)(collectionUnwatchCalled).toBe(false);
            // Cleanup effect - should trigger unwatch
            cleanup();
            (0, bun_test_1.expect)(collectionUnwatchCalled).toBe(true);
        });
        (0, bun_test_1.test)('Collection and List watched callbacks work independently', function () {
            var sourceWatchedCalled = false;
            var items = new index_ts_1.List(['hello', 'world'], {
                watched: function () {
                    sourceWatchedCalled = true;
                },
            });
            var collectionWatchedCalled = false;
            var collectionUnwatchedCalled = false;
            var uppercased = items.deriveCollection(function (x) { return x.toUpperCase(); }, {
                watched: function () {
                    collectionWatchedCalled = true;
                },
                unwatched: function () {
                    collectionUnwatchedCalled = true;
                },
            });
            // Effect 1: Access collection-level data - triggers both watched callbacks
            var collectionValue = [];
            var collectionCleanup = (0, index_ts_1.createEffect)(function () {
                collectionValue = uppercased.get();
            });
            (0, bun_test_1.expect)(collectionWatchedCalled).toBe(true);
            (0, bun_test_1.expect)(sourceWatchedCalled).toBe(true); // Source items accessed by collection.get()
            (0, bun_test_1.expect)(collectionValue).toEqual(['HELLO', 'WORLD']);
            // Effect 2: Access individual collection item independently
            var itemValue;
            var itemCleanup = (0, index_ts_1.createEffect)(function () {
                var _a;
                itemValue = (_a = uppercased.at(0)) === null || _a === void 0 ? void 0 : _a.get();
            });
            (0, bun_test_1.expect)(itemValue).toBe('HELLO');
            // Clean up effects
            collectionCleanup();
            (0, bun_test_1.expect)(collectionUnwatchedCalled).toBe(true);
            itemCleanup();
        });
        (0, bun_test_1.test)('Collection length access triggers Collection watched callback', function () {
            var numbers = new index_ts_1.List([1, 2, 3]);
            var collectionWatchedCalled = false;
            var collectionUnwatchedCalled = false;
            var doubled = numbers.deriveCollection(function (x) { return x * 2; }, {
                watched: function () {
                    collectionWatchedCalled = true;
                },
                unwatched: function () {
                    collectionUnwatchedCalled = true;
                },
            });
            // Access via collection.length - this should trigger collection's watched callback
            var effectValue = 0;
            var cleanup = (0, index_ts_1.createEffect)(function () {
                effectValue = doubled.length;
            });
            (0, bun_test_1.expect)(collectionWatchedCalled).toBe(true);
            (0, bun_test_1.expect)(effectValue).toBe(3);
            (0, bun_test_1.expect)(collectionUnwatchedCalled).toBe(false);
            cleanup();
            (0, bun_test_1.expect)(collectionUnwatchedCalled).toBe(true);
        });
    });
});
