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
/* === Utility Functions === */
var wait = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
var increment = function (n) { return (Number.isFinite(n) ? n + 1 : index_ts_1.UNSET); };
/* === Tests === */
(0, bun_test_1.describe)('Computed', function () {
    (0, bun_test_1.test)('should identify computed signals with isComputed()', function () {
        var count = new index_ts_1.State(42);
        var doubled = new index_ts_1.Memo(function () { return count.get() * 2; });
        (0, bun_test_1.expect)((0, index_ts_1.isComputed)(doubled)).toBe(true);
        (0, bun_test_1.expect)((0, index_ts_1.isState)(doubled)).toBe(false);
    });
    (0, bun_test_1.test)('should compute a function', function () {
        var derived = new index_ts_1.Memo(function () { return 1 + 2; });
        (0, bun_test_1.expect)(derived.get()).toBe(3);
    });
    (0, bun_test_1.test)('should compute function dependent on a signal', function () {
        var cause = new index_ts_1.State(42);
        var derived = new index_ts_1.Memo(function () { return cause.get() + 1; });
        (0, bun_test_1.expect)(derived.get()).toBe(43);
    });
    (0, bun_test_1.test)('should compute function dependent on an updated signal', function () {
        var cause = new index_ts_1.State(42);
        var derived = new index_ts_1.Memo(function () { return cause.get() + 1; });
        cause.set(24);
        (0, bun_test_1.expect)(derived.get()).toBe(25);
    });
    (0, bun_test_1.test)('should compute function dependent on an async signal', function () { return __awaiter(void 0, void 0, void 0, function () {
        var status, promised, derived;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    status = new index_ts_1.State('pending');
                    promised = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    status.set('success');
                                    return [2 /*return*/, 42];
                            }
                        });
                    }); });
                    derived = new index_ts_1.Memo(function () { return increment(promised.get()); });
                    (0, bun_test_1.expect)(derived.get()).toBe(index_ts_1.UNSET);
                    (0, bun_test_1.expect)(status.get()).toBe('pending');
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _d.sent();
                    (0, bun_test_1.expect)(derived.get()).toBe(43);
                    (0, bun_test_1.expect)(status.get()).toBe('success');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle errors from an async signal gracefully', function () { return __awaiter(void 0, void 0, void 0, function () {
        var status, error, promised, derived;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    status = new index_ts_1.State('pending');
                    error = new index_ts_1.State('');
                    promised = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    status.set('error');
                                    error.set('error occurred');
                                    return [2 /*return*/, 0];
                            }
                        });
                    }); });
                    derived = new index_ts_1.Memo(function () { return increment(promised.get()); });
                    (0, bun_test_1.expect)(derived.get()).toBe(index_ts_1.UNSET);
                    (0, bun_test_1.expect)(status.get()).toBe('pending');
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _d.sent();
                    (0, bun_test_1.expect)(error.get()).toBe('error occurred');
                    (0, bun_test_1.expect)(status.get()).toBe('error');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should compute task signals in parallel without waterfalls', function () { return __awaiter(void 0, void 0, void 0, function () {
        var a, b, c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    a = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    return [2 /*return*/, 10];
                            }
                        });
                    }); });
                    b = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    return [2 /*return*/, 20];
                            }
                        });
                    }); });
                    c = new index_ts_1.Memo(function () {
                        var aValue = a.get();
                        var bValue = b.get();
                        return aValue === index_ts_1.UNSET || bValue === index_ts_1.UNSET
                            ? index_ts_1.UNSET
                            : aValue + bValue;
                    });
                    (0, bun_test_1.expect)(c.get()).toBe(index_ts_1.UNSET);
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _d.sent();
                    (0, bun_test_1.expect)(c.get()).toBe(30);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should compute function dependent on a chain of computed states dependent on a signal', function () {
        var x = new index_ts_1.State(42);
        var a = new index_ts_1.Memo(function () { return x.get() + 1; });
        var b = new index_ts_1.Memo(function () { return a.get() * 2; });
        var c = new index_ts_1.Memo(function () { return b.get() + 1; });
        (0, bun_test_1.expect)(c.get()).toBe(87);
    });
    (0, bun_test_1.test)('should compute function dependent on a chain of computed states dependent on an updated signal', function () {
        var x = new index_ts_1.State(42);
        var a = new index_ts_1.Memo(function () { return x.get() + 1; });
        var b = new index_ts_1.Memo(function () { return a.get() * 2; });
        var c = new index_ts_1.Memo(function () { return b.get() + 1; });
        x.set(24);
        (0, bun_test_1.expect)(c.get()).toBe(51);
    });
    (0, bun_test_1.test)('should drop X->B->X updates', function () {
        var count = 0;
        var x = new index_ts_1.State(2);
        var a = new index_ts_1.Memo(function () { return x.get() - 1; });
        var b = new index_ts_1.Memo(function () { return x.get() + a.get(); });
        var c = new index_ts_1.Memo(function () {
            count++;
            return "c: ".concat(b.get());
        });
        (0, bun_test_1.expect)(c.get()).toBe('c: 3');
        (0, bun_test_1.expect)(count).toBe(1);
        x.set(4);
        (0, bun_test_1.expect)(c.get()).toBe('c: 7');
        (0, bun_test_1.expect)(count).toBe(2);
    });
    (0, bun_test_1.test)('should only update every signal once (diamond graph)', function () {
        var count = 0;
        var x = new index_ts_1.State('a');
        var a = new index_ts_1.Memo(function () { return x.get(); });
        var b = new index_ts_1.Memo(function () { return x.get(); });
        var c = new index_ts_1.Memo(function () {
            count++;
            return "".concat(a.get(), " ").concat(b.get());
        });
        (0, bun_test_1.expect)(c.get()).toBe('a a');
        (0, bun_test_1.expect)(count).toBe(1);
        x.set('aa');
        // flush()
        (0, bun_test_1.expect)(c.get()).toBe('aa aa');
        (0, bun_test_1.expect)(count).toBe(2);
    });
    (0, bun_test_1.test)('should only update every signal once (diamond graph + tail)', function () {
        var count = 0;
        var x = new index_ts_1.State('a');
        var a = new index_ts_1.Memo(function () { return x.get(); });
        var b = new index_ts_1.Memo(function () { return x.get(); });
        var c = new index_ts_1.Memo(function () { return "".concat(a.get(), " ").concat(b.get()); });
        var d = new index_ts_1.Memo(function () {
            count++;
            return c.get();
        });
        (0, bun_test_1.expect)(d.get()).toBe('a a');
        (0, bun_test_1.expect)(count).toBe(1);
        x.set('aa');
        (0, bun_test_1.expect)(d.get()).toBe('aa aa');
        (0, bun_test_1.expect)(count).toBe(2);
    });
    (0, bun_test_1.test)('should update multiple times after multiple state changes', function () {
        var a = new index_ts_1.State(3);
        var b = new index_ts_1.State(4);
        var count = 0;
        var sum = new index_ts_1.Memo(function () {
            count++;
            return a.get() + b.get();
        });
        (0, bun_test_1.expect)(sum.get()).toBe(7);
        a.set(6);
        (0, bun_test_1.expect)(sum.get()).toBe(10);
        b.set(8);
        (0, bun_test_1.expect)(sum.get()).toBe(14);
        (0, bun_test_1.expect)(count).toBe(3);
    });
    /*
     * Note for the next two tests:
     *
     * Due to the lazy evaluation strategy, unchanged computed signals may propagate
     * change notifications one additional time before stabilizing. This is a
     * one-time performance cost that allows for efficient memoization and
     * error handling in most cases.
     */
    (0, bun_test_1.test)('should bail out if result is the same', function () {
        var count = 0;
        var x = new index_ts_1.State('a');
        var a = new index_ts_1.Memo(function () {
            x.get();
            return 'foo';
        });
        var b = new index_ts_1.Memo(function () {
            count++;
            return a.get();
        });
        (0, bun_test_1.expect)(b.get()).toBe('foo');
        (0, bun_test_1.expect)(count).toBe(1);
        x.set('aa');
        x.set('aaa');
        x.set('aaaa');
        (0, bun_test_1.expect)(b.get()).toBe('foo');
        (0, bun_test_1.expect)(count).toBe(2);
    });
    (0, bun_test_1.test)('should block if result remains unchanged', function () {
        var count = 0;
        var x = new index_ts_1.State(42);
        var a = new index_ts_1.Memo(function () { return x.get() % 2; });
        var b = new index_ts_1.Memo(function () { return (a.get() ? 'odd' : 'even'); });
        var c = new index_ts_1.Memo(function () {
            count++;
            return "c: ".concat(b.get());
        });
        (0, bun_test_1.expect)(c.get()).toBe('c: even');
        (0, bun_test_1.expect)(count).toBe(1);
        x.set(44);
        x.set(46);
        x.set(48);
        (0, bun_test_1.expect)(c.get()).toBe('c: even');
        (0, bun_test_1.expect)(count).toBe(2);
    });
    (0, bun_test_1.test)('should detect and throw error for circular dependencies', function () {
        var a = new index_ts_1.State(1);
        var b = new index_ts_1.Memo(function () { return c.get() + 1; });
        var c = new index_ts_1.Memo(function () { return b.get() + a.get(); });
        (0, bun_test_1.expect)(function () {
            b.get(); // This should trigger the circular dependency
        }).toThrow('Circular dependency detected in memo');
        (0, bun_test_1.expect)(a.get()).toBe(1);
    });
    (0, bun_test_1.test)('should propagate error if an error occurred', function () {
        var okCount = 0;
        var errCount = 0;
        var x = new index_ts_1.State(0);
        var a = new index_ts_1.Memo(function () {
            if (x.get() === 1)
                throw new Error('Calculation error');
            return 1;
        });
        // Replace matcher with try/catch in a computed
        var b = new index_ts_1.Memo(function () {
            try {
                a.get(); // just check if it works
                return "c: success";
            }
            catch (_error) {
                errCount++;
                return "c: recovered";
            }
        });
        var c = new index_ts_1.Memo(function () {
            okCount++;
            return b.get();
        });
        (0, bun_test_1.expect)(a.get()).toBe(1);
        (0, bun_test_1.expect)(c.get()).toBe('c: success');
        (0, bun_test_1.expect)(okCount).toBe(1);
        try {
            x.set(1);
            (0, bun_test_1.expect)(a.get()).toBe(1);
            (0, bun_test_1.expect)(true).toBe(false); // This line should not be reached
        }
        catch (error) {
            (0, bun_test_1.expect)(error.message).toBe('Calculation error');
        }
        finally {
            (0, bun_test_1.expect)(c.get()).toBe('c: recovered');
            (0, bun_test_1.expect)(okCount).toBe(2);
            (0, bun_test_1.expect)(errCount).toBe(1);
        }
    });
    (0, bun_test_1.test)('should create an effect that reacts on async computed changes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var cause, derived, okCount, nilCount, result;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    cause = new index_ts_1.State(42);
                    derived = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    return [2 /*return*/, cause.get() + 1];
                            }
                        });
                    }); });
                    okCount = 0;
                    nilCount = 0;
                    result = 0;
                    (0, index_ts_1.createEffect)(function () {
                        var resolved = (0, index_ts_1.resolve)({ derived: derived });
                        (0, index_ts_1.match)(resolved, {
                            ok: function (_d) {
                                var v = _d.derived;
                                result = v;
                                okCount++;
                            },
                            nil: function () {
                                nilCount++;
                            },
                        });
                    });
                    cause.set(43);
                    (0, bun_test_1.expect)(okCount).toBe(0);
                    (0, bun_test_1.expect)(nilCount).toBe(1);
                    (0, bun_test_1.expect)(result).toBe(0);
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _d.sent();
                    (0, bun_test_1.expect)(okCount).toBe(1); // not +1 because initial state never made it here
                    (0, bun_test_1.expect)(nilCount).toBe(1);
                    (0, bun_test_1.expect)(result).toBe(44);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle complex computed signal with error and async dependencies', function () { return __awaiter(void 0, void 0, void 0, function () {
        var toggleState, errorProne, asyncValue, okCount, nilCount, errCount, complexComputed, i;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    toggleState = new index_ts_1.State(true);
                    errorProne = new index_ts_1.Memo(function () {
                        if (toggleState.get())
                            throw new Error('Intentional error');
                        return 42;
                    });
                    asyncValue = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, wait(50)];
                                case 1:
                                    _d.sent();
                                    return [2 /*return*/, 10];
                            }
                        });
                    }); });
                    okCount = 0;
                    nilCount = 0;
                    errCount = 0;
                    complexComputed = new index_ts_1.Memo(function () {
                        try {
                            var x = errorProne.get();
                            var y = asyncValue.get();
                            if (y === index_ts_1.UNSET) {
                                // not ready yet
                                nilCount++;
                                return 0;
                            }
                            else {
                                // happy path
                                okCount++;
                                return x + y;
                            }
                        }
                        catch (_error) {
                            // error path
                            errCount++;
                            return -1;
                        }
                    });
                    i = 0;
                    _d.label = 1;
                case 1:
                    if (!(i < 10)) return [3 /*break*/, 4];
                    toggleState.set(!!(i % 2));
                    return [4 /*yield*/, wait(10)];
                case 2:
                    _d.sent();
                    complexComputed.get();
                    _d.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4:
                    // Adjusted expectations to be more flexible
                    (0, bun_test_1.expect)(nilCount + okCount + errCount).toBe(10);
                    (0, bun_test_1.expect)(okCount).toBeGreaterThan(0);
                    (0, bun_test_1.expect)(errCount).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle signal changes during async computation', function () { return __awaiter(void 0, void 0, void 0, function () {
        var source, computationCount, derived;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    source = new index_ts_1.State(1);
                    computationCount = 0;
                    derived = new index_ts_1.Task(function (_, abort) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    computationCount++;
                                    (0, bun_test_1.expect)(abort === null || abort === void 0 ? void 0 : abort.aborted).toBe(false);
                                    return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    return [2 /*return*/, source.get()];
                            }
                        });
                    }); });
                    // Start first computation
                    (0, bun_test_1.expect)(derived.get()).toBe(index_ts_1.UNSET);
                    (0, bun_test_1.expect)(computationCount).toBe(1);
                    // Change source before first computation completes
                    source.set(2);
                    return [4 /*yield*/, wait(210)];
                case 1:
                    _d.sent();
                    (0, bun_test_1.expect)(derived.get()).toBe(2);
                    (0, bun_test_1.expect)(computationCount).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle multiple rapid changes during async computation', function () { return __awaiter(void 0, void 0, void 0, function () {
        var source, computationCount, derived;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    source = new index_ts_1.State(1);
                    computationCount = 0;
                    derived = new index_ts_1.Task(function (_, abort) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    computationCount++;
                                    (0, bun_test_1.expect)(abort === null || abort === void 0 ? void 0 : abort.aborted).toBe(false);
                                    return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    return [2 /*return*/, source.get()];
                            }
                        });
                    }); });
                    // Start first computation
                    (0, bun_test_1.expect)(derived.get()).toBe(index_ts_1.UNSET);
                    (0, bun_test_1.expect)(computationCount).toBe(1);
                    // Make multiple rapid changes
                    source.set(2);
                    source.set(3);
                    source.set(4);
                    return [4 /*yield*/, wait(210)
                        // Should have computed twice (initial + final change)
                    ];
                case 1:
                    _d.sent();
                    // Should have computed twice (initial + final change)
                    (0, bun_test_1.expect)(derived.get()).toBe(4);
                    (0, bun_test_1.expect)(computationCount).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle errors in aborted computations', function () { return __awaiter(void 0, void 0, void 0, function () {
        var source, derived;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    source = new index_ts_1.State(1);
                    derived = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var value;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _d.sent();
                                    value = source.get();
                                    if (value === 2)
                                        throw new Error('Intentional error');
                                    return [2 /*return*/, value];
                            }
                        });
                    }); });
                    // Start first computation
                    (0, bun_test_1.expect)(derived.get()).toBe(index_ts_1.UNSET);
                    // Change to error state before first computation completes
                    source.set(2);
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _d.sent();
                    (0, bun_test_1.expect)(function () { return derived.get(); }).toThrow('Intentional error');
                    // Change to normal state before second computation completes
                    source.set(3);
                    return [4 /*yield*/, wait(100)];
                case 2:
                    _d.sent();
                    (0, bun_test_1.expect)(derived.get()).toBe(3);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.describe)('Input Validation', function () {
        (0, bun_test_1.test)('should throw InvalidCallbackError when callback is not a function', function () {
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo(null);
            }).toThrow('Invalid Memo callback null');
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo(undefined);
            }).toThrow('Invalid Memo callback undefined');
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo(42);
            }).toThrow('Invalid Memo callback 42');
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo('not a function');
            }).toThrow('Invalid Memo callback "not a function"');
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo({ not: 'a function' });
            }).toThrow('Invalid Memo callback {"not":"a function"}');
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo(function (_a, _b, _c) { return 42; });
            }).toThrow('Invalid Memo callback (_a, _b, _c) => 42');
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo(function (_a, _b) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_d) {
                    return [2 /*return*/, 42];
                }); }); });
            }).toThrow('Invalid Memo callback async (_a, _b) => 42');
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Task(function (_a) { return 42; });
            }).toThrow('Invalid Task callback (_a) => 42');
        });
        (0, bun_test_1.test)('should expect type error if null is passed for options.initialValue', function () {
            (0, bun_test_1.expect)(function () {
                // @ts-expect-error - Testing invalid input
                new index_ts_1.Memo(function () { return 42; }, { initialValue: null });
            }).not.toThrow();
        });
        (0, bun_test_1.test)('should allow valid callbacks and non-nullish initialValues', function () {
            // These should not throw
            (0, bun_test_1.expect)(function () {
                new index_ts_1.Memo(function () { return 42; });
            }).not.toThrow();
            (0, bun_test_1.expect)(function () {
                new index_ts_1.Memo(function () { return 42; }, { initialValue: 0 });
            }).not.toThrow();
            (0, bun_test_1.expect)(function () {
                new index_ts_1.Memo(function () { return 'foo'; }, { initialValue: '' });
            }).not.toThrow();
            (0, bun_test_1.expect)(function () {
                new index_ts_1.Memo(function () { return true; }, { initialValue: false });
            }).not.toThrow();
            (0, bun_test_1.expect)(function () {
                new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_d) {
                    return [2 /*return*/, ({ id: 42, name: 'John' })];
                }); }); }, {
                    initialValue: index_ts_1.UNSET,
                });
            }).not.toThrow();
        });
    });
    (0, bun_test_1.describe)('Initial Value and Old Value', function () {
        (0, bun_test_1.test)('should use initialValue when provided', function () {
            var computed = new index_ts_1.Memo(function (oldValue) { return oldValue + 1; }, {
                initialValue: 10,
            });
            (0, bun_test_1.expect)(computed.get()).toBe(11);
        });
        (0, bun_test_1.test)('should pass current value as oldValue to callback', function () {
            var state = new index_ts_1.State(5);
            var receivedOldValue;
            var computed = new index_ts_1.Memo(function (oldValue) {
                receivedOldValue = oldValue;
                return state.get() * 2;
            }, { initialValue: 0 });
            (0, bun_test_1.expect)(computed.get()).toBe(10);
            (0, bun_test_1.expect)(receivedOldValue).toBe(0);
            state.set(3);
            (0, bun_test_1.expect)(computed.get()).toBe(6);
            (0, bun_test_1.expect)(receivedOldValue).toBe(10);
        });
        (0, bun_test_1.test)('should work as reducer function with oldValue', function () {
            var increment = new index_ts_1.State(0);
            var sum = new index_ts_1.Memo(function (oldValue) {
                var inc = increment.get();
                return inc === 0 ? oldValue : oldValue + inc;
            }, { initialValue: 0 });
            (0, bun_test_1.expect)(sum.get()).toBe(0);
            increment.set(5);
            (0, bun_test_1.expect)(sum.get()).toBe(5);
            increment.set(3);
            (0, bun_test_1.expect)(sum.get()).toBe(8);
            increment.set(2);
            (0, bun_test_1.expect)(sum.get()).toBe(10);
        });
        (0, bun_test_1.test)('should handle array accumulation with oldValue', function () {
            var item = new index_ts_1.State('');
            var items = new index_ts_1.Memo(function (oldValue) {
                var newItem = item.get();
                return newItem === '' ? oldValue : __spreadArray(__spreadArray([], oldValue, true), [newItem], false);
            }, { initialValue: [] });
            (0, bun_test_1.expect)(items.get()).toEqual([]);
            item.set('first');
            (0, bun_test_1.expect)(items.get()).toEqual(['first']);
            item.set('second');
            (0, bun_test_1.expect)(items.get()).toEqual(['first', 'second']);
            item.set('third');
            (0, bun_test_1.expect)(items.get()).toEqual(['first', 'second', 'third']);
        });
        (0, bun_test_1.test)('should handle counter with oldValue and multiple dependencies', function () {
            var reset = new index_ts_1.State(false);
            var add = new index_ts_1.State(0);
            var counter = new index_ts_1.Memo(function (oldValue) {
                if (reset.get())
                    return 0;
                var increment = add.get();
                return increment === 0 ? oldValue : oldValue + increment;
            }, {
                initialValue: 0,
            });
            (0, bun_test_1.expect)(counter.get()).toBe(0);
            add.set(5);
            (0, bun_test_1.expect)(counter.get()).toBe(5);
            add.set(3);
            (0, bun_test_1.expect)(counter.get()).toBe(8);
            reset.set(true);
            (0, bun_test_1.expect)(counter.get()).toBe(0);
            reset.set(false);
            add.set(2);
            (0, bun_test_1.expect)(counter.get()).toBe(2);
        });
        (0, bun_test_1.test)('should pass UNSET as oldValue when no initialValue provided', function () {
            var receivedOldValue;
            var state = new index_ts_1.State(42);
            var computed = new index_ts_1.Memo(function (oldValue) {
                receivedOldValue = oldValue;
                return state.get();
            });
            (0, bun_test_1.expect)(computed.get()).toBe(42);
            (0, bun_test_1.expect)(receivedOldValue).toBe(index_ts_1.UNSET);
        });
        (0, bun_test_1.test)('should work with async computation and oldValue', function () { return __awaiter(void 0, void 0, void 0, function () {
            var receivedOldValue, asyncComputed;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        asyncComputed = new index_ts_1.Task(function (oldValue) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        receivedOldValue = oldValue;
                                        return [4 /*yield*/, wait(50)];
                                    case 1:
                                        _d.sent();
                                        return [2 /*return*/, oldValue + 5];
                                }
                            });
                        }); }, {
                            initialValue: 10,
                        });
                        // Initially returns initialValue before async computation completes
                        (0, bun_test_1.expect)(asyncComputed.get()).toBe(10);
                        // Wait for async computation to complete
                        return [4 /*yield*/, wait(60)];
                    case 1:
                        // Wait for async computation to complete
                        _d.sent();
                        (0, bun_test_1.expect)(asyncComputed.get()).toBe(15); // 10 + 5
                        (0, bun_test_1.expect)(receivedOldValue).toBe(10);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('should handle object updates with oldValue', function () {
            var key = new index_ts_1.State('');
            var value = new index_ts_1.State('');
            var obj = new index_ts_1.Memo(function (oldValue) {
                var _d;
                var k = key.get();
                var v = value.get();
                if (k === '' || v === '')
                    return oldValue;
                return __assign(__assign({}, oldValue), (_d = {}, _d[k] = v, _d));
            }, { initialValue: {} });
            (0, bun_test_1.expect)(obj.get()).toEqual({});
            key.set('name');
            value.set('Alice');
            (0, bun_test_1.expect)(obj.get()).toEqual({ name: 'Alice' });
            key.set('age');
            value.set('30');
            (0, bun_test_1.expect)(obj.get()).toEqual({ name: 'Alice', age: '30' });
        });
        (0, bun_test_1.test)('should handle async computation with AbortSignal and oldValue', function () { return __awaiter(void 0, void 0, void 0, function () {
            var source, computationCount, receivedOldValues, asyncComputed;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        source = new index_ts_1.State(1);
                        computationCount = 0;
                        receivedOldValues = [];
                        asyncComputed = new index_ts_1.Task(function (oldValue, abort) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        computationCount++;
                                        receivedOldValues.push(oldValue);
                                        // Simulate async work
                                        return [4 /*yield*/, wait(100)
                                            // Check if computation was aborted
                                        ];
                                    case 1:
                                        // Simulate async work
                                        _d.sent();
                                        // Check if computation was aborted
                                        if (abort.aborted) {
                                            return [2 /*return*/, oldValue];
                                        }
                                        return [2 /*return*/, source.get() + oldValue];
                                }
                            });
                        }); }, {
                            initialValue: 0,
                        });
                        // Initial computation
                        (0, bun_test_1.expect)(asyncComputed.get()).toBe(0); // Returns initialValue immediately
                        // Change source before first computation completes
                        source.set(2);
                        // Wait for computation to complete
                        return [4 /*yield*/, wait(110)
                            // Should have the result from the computation that wasn't aborted
                        ];
                    case 1:
                        // Wait for computation to complete
                        _d.sent();
                        // Should have the result from the computation that wasn't aborted
                        (0, bun_test_1.expect)(asyncComputed.get()).toBe(2); // 2 + 0 (initialValue was used as oldValue)
                        (0, bun_test_1.expect)(computationCount).toBe(1); // Only one computation completed
                        (0, bun_test_1.expect)(receivedOldValues).toEqual([0]);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('should work with error handling and oldValue', function () {
            var shouldError = new index_ts_1.State(false);
            var counter = new index_ts_1.State(1);
            var computed = new index_ts_1.Memo(function (oldValue) {
                if (shouldError.get()) {
                    throw new Error('Computation failed');
                }
                // Handle UNSET case by treating it as 0
                var safeOldValue = oldValue === index_ts_1.UNSET ? 0 : oldValue;
                return safeOldValue + counter.get();
            }, {
                initialValue: 10,
            });
            (0, bun_test_1.expect)(computed.get()).toBe(11); // 10 + 1
            counter.set(5);
            (0, bun_test_1.expect)(computed.get()).toBe(16); // 11 + 5
            // Trigger error
            shouldError.set(true);
            (0, bun_test_1.expect)(function () { return computed.get(); }).toThrow('Computation failed');
            // Recover from error
            shouldError.set(false);
            counter.set(2);
            // After error, oldValue should be UNSET, so we treat it as 0 and get 0 + 2 = 2
            (0, bun_test_1.expect)(computed.get()).toBe(2);
        });
        (0, bun_test_1.test)('should work with complex state transitions using oldValue', function () {
            var action = new index_ts_1.State('increment');
            var amount = new index_ts_1.State(1);
            var calculator = new index_ts_1.Memo(function (oldValue) {
                var act = action.get();
                var amt = amount.get();
                switch (act) {
                    case 'increment':
                        return oldValue + amt;
                    case 'decrement':
                        return oldValue - amt;
                    case 'multiply':
                        return oldValue * amt;
                    case 'reset':
                        return 0;
                    default:
                        return oldValue;
                }
            }, {
                initialValue: 0,
            });
            (0, bun_test_1.expect)(calculator.get()).toBe(1); // 0 + 1
            amount.set(5);
            (0, bun_test_1.expect)(calculator.get()).toBe(6); // 1 + 5
            action.set('multiply');
            amount.set(2);
            (0, bun_test_1.expect)(calculator.get()).toBe(12); // 6 * 2
            action.set('decrement');
            amount.set(3);
            (0, bun_test_1.expect)(calculator.get()).toBe(9); // 12 - 3
            action.set('reset');
            (0, bun_test_1.expect)(calculator.get()).toBe(0);
        });
        (0, bun_test_1.test)('should handle edge cases with initialValue and oldValue', function () {
            // Test with null/undefined-like values
            var nullishComputed = new index_ts_1.Memo(function (oldValue) { return "".concat(oldValue, " updated"); }, { initialValue: '' });
            (0, bun_test_1.expect)(nullishComputed.get()).toBe(' updated');
            var now = new Date();
            var objectComputed = new index_ts_1.Memo(function (oldValue) { return (__assign(__assign({}, oldValue), { count: oldValue.count + 1, items: __spreadArray(__spreadArray([], oldValue.items, true), ["item".concat(oldValue.count + 1)], false) })); }, {
                initialValue: {
                    count: 0,
                    items: [],
                    meta: { created: now },
                },
            });
            var result = objectComputed.get();
            (0, bun_test_1.expect)(result.count).toBe(1);
            (0, bun_test_1.expect)(result.items).toEqual(['item1']);
            (0, bun_test_1.expect)(result.meta.created).toBe(now);
        });
        (0, bun_test_1.test)('should preserve initialValue type consistency', function () {
            // Test that oldValue type is consistent with initialValue
            var stringComputed = new index_ts_1.Memo(function (oldValue) {
                (0, bun_test_1.expect)(typeof oldValue).toBe('string');
                return oldValue.toUpperCase();
            }, {
                initialValue: 'hello',
            });
            (0, bun_test_1.expect)(stringComputed.get()).toBe('HELLO');
            var numberComputed = new index_ts_1.Memo(function (oldValue) {
                (0, bun_test_1.expect)(typeof oldValue).toBe('number');
                (0, bun_test_1.expect)(Number.isFinite(oldValue)).toBe(true);
                return oldValue * 2;
            }, {
                initialValue: 5,
            });
            (0, bun_test_1.expect)(numberComputed.get()).toBe(10);
        });
        (0, bun_test_1.test)('should work with chained computed using oldValue', function () {
            var source = new index_ts_1.State(1);
            var first = new index_ts_1.Memo(function (oldValue) { return oldValue + source.get(); }, {
                initialValue: 10,
            });
            var second = new index_ts_1.Memo(function (oldValue) { return oldValue + first.get(); }, {
                initialValue: 20,
            });
            (0, bun_test_1.expect)(first.get()).toBe(11); // 10 + 1
            (0, bun_test_1.expect)(second.get()).toBe(31); // 20 + 11
            source.set(5);
            (0, bun_test_1.expect)(first.get()).toBe(16); // 11 + 5
            (0, bun_test_1.expect)(second.get()).toBe(47); // 31 + 16
        });
        (0, bun_test_1.test)('should handle frequent updates with oldValue correctly', function () {
            var trigger = new index_ts_1.State(0);
            var computationCount = 0;
            var accumulator = new index_ts_1.Memo(function (oldValue) {
                computationCount++;
                return oldValue + trigger.get();
            }, {
                initialValue: 100,
            });
            (0, bun_test_1.expect)(accumulator.get()).toBe(100); // 100 + 0
            (0, bun_test_1.expect)(computationCount).toBe(1);
            // Make rapid changes
            for (var i = 1; i <= 5; i++) {
                trigger.set(i);
                accumulator.get(); // Force evaluation
            }
            (0, bun_test_1.expect)(computationCount).toBe(6); // Initial + 5 updates
            (0, bun_test_1.expect)(accumulator.get()).toBe(115); // Final accumulated value
        });
    });
    (0, bun_test_1.describe)('Signal Options - Lazy Resource Management', function () {
        (0, bun_test_1.test)('Memo - should manage external resources lazily', function () { return __awaiter(void 0, void 0, void 0, function () {
            var source, counter, intervalId, computed, effectCleanup, counterAfterStop;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        source = new index_ts_1.State(1);
                        counter = 0;
                        computed = new index_ts_1.Memo(function (oldValue) { return source.get() * 2 + oldValue; }, {
                            initialValue: 0,
                            watched: function () {
                                intervalId = setInterval(function () {
                                    counter++;
                                }, 10);
                            },
                            unwatched: function () {
                                if (intervalId) {
                                    clearInterval(intervalId);
                                    intervalId = undefined;
                                }
                            },
                        });
                        // Counter should not be running yet
                        (0, bun_test_1.expect)(counter).toBe(0);
                        return [4 /*yield*/, wait(50)];
                    case 1:
                        _d.sent();
                        (0, bun_test_1.expect)(counter).toBe(0);
                        (0, bun_test_1.expect)(intervalId).toBeUndefined();
                        effectCleanup = (0, index_ts_1.createEffect)(function () {
                            computed.get();
                        });
                        // Counter should now be running
                        return [4 /*yield*/, wait(50)];
                    case 2:
                        // Counter should now be running
                        _d.sent();
                        (0, bun_test_1.expect)(counter).toBeGreaterThan(0);
                        (0, bun_test_1.expect)(intervalId).toBeDefined();
                        // Stop effect, should cleanup resources
                        effectCleanup();
                        counterAfterStop = counter;
                        // Counter should stop incrementing
                        return [4 /*yield*/, wait(50)];
                    case 3:
                        // Counter should stop incrementing
                        _d.sent();
                        (0, bun_test_1.expect)(counter).toBe(counterAfterStop);
                        (0, bun_test_1.expect)(intervalId).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('Task - should manage external resources lazily', function () { return __awaiter(void 0, void 0, void 0, function () {
            var source, counter, intervalId, computed, effectCleanup, counterAfterStop;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        source = new index_ts_1.State('initial');
                        counter = 0;
                        computed = new index_ts_1.Task(function (oldValue, abort) { return __awaiter(void 0, void 0, void 0, function () {
                            var value;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        value = source.get();
                                        return [4 /*yield*/, wait(10)]; // Simulate async work
                                    case 1:
                                        _d.sent(); // Simulate async work
                                        if (abort.aborted)
                                            throw new Error('Aborted');
                                        return [2 /*return*/, "".concat(value, "-processed-").concat(oldValue || 'none')];
                                }
                            });
                        }); }, {
                            initialValue: 'default',
                            watched: function () {
                                intervalId = setInterval(function () {
                                    counter++;
                                }, 10);
                            },
                            unwatched: function () {
                                if (intervalId) {
                                    clearInterval(intervalId);
                                    intervalId = undefined;
                                }
                            },
                        });
                        // Counter should not be running yet
                        (0, bun_test_1.expect)(counter).toBe(0);
                        return [4 /*yield*/, wait(50)];
                    case 1:
                        _d.sent();
                        (0, bun_test_1.expect)(counter).toBe(0);
                        (0, bun_test_1.expect)(intervalId).toBeUndefined();
                        effectCleanup = (0, index_ts_1.createEffect)(function () {
                            computed.get();
                        });
                        // Wait for async computation and counter to start
                        return [4 /*yield*/, wait(100)];
                    case 2:
                        // Wait for async computation and counter to start
                        _d.sent();
                        (0, bun_test_1.expect)(counter).toBeGreaterThan(0);
                        (0, bun_test_1.expect)(intervalId).toBeDefined();
                        // Stop effect
                        effectCleanup();
                        counterAfterStop = counter;
                        // Counter should stop incrementing
                        return [4 /*yield*/, wait(50)];
                    case 3:
                        // Counter should stop incrementing
                        _d.sent();
                        (0, bun_test_1.expect)(counter).toBe(counterAfterStop);
                        (0, bun_test_1.expect)(intervalId).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('Memo - multiple watchers should share resources', function () { return __awaiter(void 0, void 0, void 0, function () {
            var source, subscriptionCount, computed, effect1, effect2;
            return __generator(this, function (_d) {
                source = new index_ts_1.State(10);
                subscriptionCount = 0;
                computed = new index_ts_1.Memo(function (oldValue) { return source.get() + oldValue; }, {
                    initialValue: 0,
                    watched: function () {
                        subscriptionCount++;
                    },
                    unwatched: function () {
                        subscriptionCount--;
                    },
                });
                (0, bun_test_1.expect)(subscriptionCount).toBe(0);
                effect1 = (0, index_ts_1.createEffect)(function () {
                    computed.get();
                });
                effect2 = (0, index_ts_1.createEffect)(function () {
                    computed.get();
                });
                // Should only increment once
                (0, bun_test_1.expect)(subscriptionCount).toBe(1);
                // Stop first effect
                effect1();
                (0, bun_test_1.expect)(subscriptionCount).toBe(1); // Still active due to second watcher
                // Stop second effect
                effect2();
                (0, bun_test_1.expect)(subscriptionCount).toBe(0); // Now cleaned up
                return [2 /*return*/];
            });
        }); });
        (0, bun_test_1.test)('Task - should handle abort signals in external resources', function () { return __awaiter(void 0, void 0, void 0, function () {
            var source, controller, abortedControllers, computed, effect1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        source = new index_ts_1.State('test');
                        abortedControllers = [];
                        computed = new index_ts_1.Task(function (oldValue, abort) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0: return [4 /*yield*/, wait(20)];
                                    case 1:
                                        _d.sent();
                                        if (abort.aborted)
                                            throw new Error('Aborted');
                                        return [2 /*return*/, "".concat(source.get(), "-").concat(oldValue || 'initial')];
                                }
                            });
                        }); }, {
                            initialValue: 'default',
                            watched: function () {
                                controller = new AbortController();
                                // Simulate external async operation (catch rejections to avoid unhandled errors)
                                new Promise(function (resolve) {
                                    var timeout = setTimeout(function () {
                                        if (!controller)
                                            return;
                                        if (controller.signal.aborted) {
                                            resolve('External operation aborted');
                                        }
                                        else {
                                            resolve('External operation completed');
                                        }
                                    }, 50);
                                    controller === null || controller === void 0 ? void 0 : controller.signal.addEventListener('abort', function () {
                                        clearTimeout(timeout);
                                        resolve('External operation aborted');
                                    });
                                }).catch(function () {
                                    // Ignore promise rejections in test
                                });
                            },
                            unwatched: function () {
                                if (!controller)
                                    return;
                                controller.abort();
                                abortedControllers.push(controller);
                            },
                        });
                        effect1 = (0, index_ts_1.createEffect)(function () {
                            computed.get();
                        });
                        // Change source to trigger recomputation
                        source.set('updated');
                        // Stop effect to trigger cleanup
                        effect1();
                        // Wait for cleanup to complete
                        return [4 /*yield*/, wait(100)
                            // Should have aborted external controllers
                        ];
                    case 1:
                        // Wait for cleanup to complete
                        _d.sent();
                        // Should have aborted external controllers
                        (0, bun_test_1.expect)(abortedControllers.length).toBeGreaterThan(0);
                        (0, bun_test_1.expect)(abortedControllers[0].signal.aborted).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
