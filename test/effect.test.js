"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_ts_1 = require("../index.ts");
/* === Utility Functions === */
var wait = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
/* === Tests === */
(0, bun_test_1.describe)('Effect', function () {
    (0, bun_test_1.test)('should be triggered after a state change', function () {
        var cause = new index_ts_1.State('foo');
        var count = 0;
        (0, index_ts_1.createEffect)(function () {
            cause.get();
            count++;
        });
        (0, bun_test_1.expect)(count).toBe(1);
        cause.set('bar');
        (0, bun_test_1.expect)(count).toBe(2);
    });
    (0, bun_test_1.test)('should be triggered after computed async signals resolve without waterfalls', function () { return __awaiter(void 0, void 0, void 0, function () {
        var a, b, result, count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    a = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, 10];
                            }
                        });
                    }); });
                    b = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, 20];
                            }
                        });
                    }); });
                    result = 0;
                    count = 0;
                    (0, index_ts_1.createEffect)(function () {
                        var resolved = (0, index_ts_1.resolve)({ a: a, b: b });
                        (0, index_ts_1.match)(resolved, {
                            ok: function (_a) {
                                var aValue = _a.a, bValue = _a.b;
                                result = aValue + bValue;
                                count++;
                            },
                        });
                    });
                    (0, bun_test_1.expect)(result).toBe(0);
                    (0, bun_test_1.expect)(count).toBe(0);
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(result).toBe(30);
                    (0, bun_test_1.expect)(count).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should be triggered repeatedly after repeated state change', function () { return __awaiter(void 0, void 0, void 0, function () {
        var cause, result, count, i;
        return __generator(this, function (_a) {
            cause = new index_ts_1.State(0);
            result = 0;
            count = 0;
            (0, index_ts_1.createEffect)(function () {
                result = cause.get();
                count++;
            });
            for (i = 0; i < 10; i++) {
                cause.set(i);
                (0, bun_test_1.expect)(result).toBe(i);
                (0, bun_test_1.expect)(count).toBe(i + 1); // + 1 for effect initialization
            }
            return [2 /*return*/];
        });
    }); });
    (0, bun_test_1.test)('should handle errors in effects with resolve handlers', function () {
        var a = new index_ts_1.State(1);
        var b = new index_ts_1.Memo(function () {
            var v = a.get();
            if (v > 5)
                throw new Error('Value too high');
            return v * 2;
        });
        var normalCallCount = 0;
        var errorCallCount = 0;
        (0, index_ts_1.createEffect)(function () {
            var resolved = (0, index_ts_1.resolve)({ b: b });
            (0, index_ts_1.match)(resolved, {
                ok: function () {
                    normalCallCount++;
                },
                err: function (errors) {
                    errorCallCount++;
                    (0, bun_test_1.expect)(errors[0].message).toBe('Value too high');
                },
            });
        });
        // Normal case
        a.set(2);
        (0, bun_test_1.expect)(normalCallCount).toBe(2);
        (0, bun_test_1.expect)(errorCallCount).toBe(0);
        // Error case
        a.set(6);
        (0, bun_test_1.expect)(normalCallCount).toBe(2);
        (0, bun_test_1.expect)(errorCallCount).toBe(1);
        // Back to normal
        a.set(3);
        (0, bun_test_1.expect)(normalCallCount).toBe(3);
        (0, bun_test_1.expect)(errorCallCount).toBe(1);
    });
    (0, bun_test_1.test)('should handle errors in effects with resolve result', function () {
        var a = new index_ts_1.State(1);
        var b = new index_ts_1.Memo(function () {
            var v = a.get();
            if (v > 5)
                throw new Error('Value too high');
            return v * 2;
        });
        var normalCallCount = 0;
        var errorCallCount = 0;
        (0, index_ts_1.createEffect)(function () {
            var result = (0, index_ts_1.resolve)({ b: b });
            if (result.ok) {
                normalCallCount++;
            }
            else if (result.errors) {
                errorCallCount++;
                (0, bun_test_1.expect)(result.errors[0].message).toBe('Value too high');
            }
        });
        // Normal case
        a.set(2);
        (0, bun_test_1.expect)(normalCallCount).toBe(2);
        (0, bun_test_1.expect)(errorCallCount).toBe(0);
        // Error case
        a.set(6);
        (0, bun_test_1.expect)(normalCallCount).toBe(2);
        (0, bun_test_1.expect)(errorCallCount).toBe(1);
        // Back to normal
        a.set(3);
        (0, bun_test_1.expect)(normalCallCount).toBe(3);
        (0, bun_test_1.expect)(errorCallCount).toBe(1);
    });
    (0, bun_test_1.test)('should handle UNSET values in effects with resolve handlers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var a, normalCallCount, nilCount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    a = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, 42];
                            }
                        });
                    }); });
                    normalCallCount = 0;
                    nilCount = 0;
                    (0, index_ts_1.createEffect)(function () {
                        var resolved = (0, index_ts_1.resolve)({ a: a });
                        (0, index_ts_1.match)(resolved, {
                            ok: function (values) {
                                normalCallCount++;
                                (0, bun_test_1.expect)(values.a).toBe(42);
                            },
                            nil: function () {
                                nilCount++;
                            },
                        });
                    });
                    (0, bun_test_1.expect)(normalCallCount).toBe(0);
                    (0, bun_test_1.expect)(nilCount).toBe(1);
                    (0, bun_test_1.expect)(a.get()).toBe(index_ts_1.UNSET);
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(normalCallCount).toBeGreaterThan(0);
                    (0, bun_test_1.expect)(nilCount).toBe(1);
                    (0, bun_test_1.expect)(a.get()).toBe(42);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle UNSET values in effects with resolve result', function () { return __awaiter(void 0, void 0, void 0, function () {
        var a, normalCallCount, nilCount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    a = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, wait(100)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, 42];
                            }
                        });
                    }); });
                    normalCallCount = 0;
                    nilCount = 0;
                    (0, index_ts_1.createEffect)(function () {
                        var result = (0, index_ts_1.resolve)({ a: a });
                        if (result.ok) {
                            normalCallCount++;
                            (0, bun_test_1.expect)(result.values.a).toBe(42);
                        }
                        else if (result.pending) {
                            nilCount++;
                        }
                    });
                    (0, bun_test_1.expect)(normalCallCount).toBe(0);
                    (0, bun_test_1.expect)(nilCount).toBe(1);
                    (0, bun_test_1.expect)(a.get()).toBe(index_ts_1.UNSET);
                    return [4 /*yield*/, wait(110)];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(normalCallCount).toBeGreaterThan(0);
                    (0, bun_test_1.expect)(nilCount).toBe(1);
                    (0, bun_test_1.expect)(a.get()).toBe(42);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should log error to console when error is not handled', function () {
        // Mock console.error
        var originalConsoleError = console.error;
        var mockConsoleError = (0, bun_test_1.mock)(function () { });
        console.error = mockConsoleError;
        try {
            var a_1 = new index_ts_1.State(1);
            var b_1 = new index_ts_1.Memo(function () {
                var v = a_1.get();
                if (v > 5)
                    throw new Error('Value too high');
                return v * 2;
            });
            // Create an effect without explicit error handling
            (0, index_ts_1.createEffect)(function () {
                b_1.get();
            });
            // This should trigger the error
            a_1.set(6);
            // Check if console.error was called with the error message
            (0, bun_test_1.expect)(mockConsoleError).toHaveBeenCalledWith('Error in effect callback:', bun_test_1.expect.any(Error));
        }
        finally {
            // Restore the original console.error
            console.error = originalConsoleError;
        }
    });
    (0, bun_test_1.test)('should clean up subscriptions when disposed', function () {
        var count = new index_ts_1.State(42);
        var received = 0;
        var cleanup = (0, index_ts_1.createEffect)(function () {
            received = count.get();
        });
        count.set(43);
        (0, bun_test_1.expect)(received).toBe(43);
        cleanup();
        count.set(44);
        (0, bun_test_1.expect)(received).toBe(43); // Should not update after dispose
    });
    (0, bun_test_1.test)('should detect and throw error for circular dependencies in effects', function () {
        var okCount = 0;
        var errCount = 0;
        var count = new index_ts_1.State(0);
        (0, index_ts_1.createEffect)(function () {
            var resolved = (0, index_ts_1.resolve)({ count: count });
            (0, index_ts_1.match)(resolved, {
                ok: function () {
                    okCount++;
                    // This effect updates the signal it depends on, creating a circular dependency
                    count.update(function (v) { return ++v; });
                },
                err: function (errors) {
                    errCount++;
                    (0, bun_test_1.expect)(errors[0]).toBeInstanceOf(Error);
                    (0, bun_test_1.expect)(errors[0].message).toBe('Circular dependency detected in effect');
                },
            });
        });
        // Verify that the count was changed only once due to the circular dependency error
        (0, bun_test_1.expect)(count.get()).toBe(1);
        (0, bun_test_1.expect)(okCount).toBe(1);
        (0, bun_test_1.expect)(errCount).toBe(1);
    });
});
(0, bun_test_1.describe)('Effect - Async with AbortSignal', function () {
    (0, bun_test_1.test)('should pass AbortSignal to async effect callback', function () { return __awaiter(void 0, void 0, void 0, function () {
        var abortSignalReceived, effectCompleted;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    abortSignalReceived = false;
                    effectCompleted = false;
                    (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    (0, bun_test_1.expect)(abort).toBeInstanceOf(AbortSignal);
                                    (0, bun_test_1.expect)(abort.aborted).toBe(false);
                                    abortSignalReceived = true;
                                    return [4 /*yield*/, wait(50)];
                                case 1:
                                    _a.sent();
                                    effectCompleted = true;
                                    return [2 /*return*/, function () { }];
                            }
                        });
                    }); });
                    (0, bun_test_1.expect)(abortSignalReceived).toBe(true);
                    return [4 /*yield*/, wait(60)];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(effectCompleted).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should abort async operations when signal changes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testSignal, operationAborted, operationCompleted, abortReason;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testSignal = new index_ts_1.State(1);
                    operationAborted = false;
                    operationCompleted = false;
                    (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        var result, error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    result = (0, index_ts_1.resolve)({ testSignal: testSignal });
                                    if (!result.ok)
                                        return [2 /*return*/];
                                    abort.addEventListener('abort', function () {
                                        operationAborted = true;
                                        abortReason = abort.reason;
                                    });
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, wait(100)];
                                case 2:
                                    _a.sent();
                                    operationCompleted = true;
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_1 = _a.sent();
                                    if (error_1 instanceof DOMException &&
                                        error_1.name === 'AbortError') {
                                        operationAborted = true;
                                    }
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Change signal quickly to trigger abort
                    return [4 /*yield*/, wait(20)];
                case 1:
                    // Change signal quickly to trigger abort
                    _a.sent();
                    testSignal.set(2);
                    return [4 /*yield*/, wait(50)];
                case 2:
                    _a.sent();
                    (0, bun_test_1.expect)(operationAborted).toBe(true);
                    (0, bun_test_1.expect)(operationCompleted).toBe(false);
                    (0, bun_test_1.expect)(abortReason instanceof DOMException).toBe(true);
                    (0, bun_test_1.expect)(abortReason.name).toBe('AbortError');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should abort async operations on effect cleanup', function () { return __awaiter(void 0, void 0, void 0, function () {
        var operationAborted, abortReason, cleanup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    operationAborted = false;
                    cleanup = (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    abort.addEventListener('abort', function () {
                                        operationAborted = true;
                                        abortReason = abort.reason;
                                    });
                                    return [4 /*yield*/, wait(100)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, wait(20)];
                case 1:
                    _a.sent();
                    cleanup();
                    return [4 /*yield*/, wait(30)];
                case 2:
                    _a.sent();
                    (0, bun_test_1.expect)(operationAborted).toBe(true);
                    (0, bun_test_1.expect)(abortReason instanceof DOMException).toBe(true);
                    (0, bun_test_1.expect)(abortReason.name).toBe('AbortError');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle AbortError gracefully without logging to console', function () { return __awaiter(void 0, void 0, void 0, function () {
        var originalConsoleError, mockConsoleError, testSignal_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    originalConsoleError = console.error;
                    mockConsoleError = (0, bun_test_1.mock)(function () { });
                    console.error = mockConsoleError;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 4, 5]);
                    testSignal_1 = new index_ts_1.State(1);
                    (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        var result, error_2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    result = (0, index_ts_1.resolve)({ testSignal: testSignal_1 });
                                    if (!result.ok)
                                        return [2 /*return*/];
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                                            var timeout = setTimeout(resolve, 100);
                                            abort.addEventListener('abort', function () {
                                                clearTimeout(timeout);
                                                reject(new DOMException('Aborted', 'AbortError'));
                                            });
                                        })];
                                case 2:
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_2 = _a.sent();
                                    if (error_2 instanceof DOMException &&
                                        error_2.name === 'AbortError') {
                                        // This is expected, should not be logged
                                        return [2 /*return*/];
                                    }
                                    else {
                                        throw error_2;
                                    }
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, wait(20)];
                case 2:
                    _a.sent();
                    testSignal_1.set(2);
                    return [4 /*yield*/, wait(50)
                        // Should not have logged the AbortError
                    ];
                case 3:
                    _a.sent();
                    // Should not have logged the AbortError
                    (0, bun_test_1.expect)(mockConsoleError).not.toHaveBeenCalledWith('Effect callback error:', bun_test_1.expect.any(DOMException));
                    return [3 /*break*/, 5];
                case 4:
                    console.error = originalConsoleError;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle async effects that return cleanup functions', function () { return __awaiter(void 0, void 0, void 0, function () {
        var asyncEffectCompleted, cleanupRegistered, testSignal, cleanup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    asyncEffectCompleted = false;
                    cleanupRegistered = false;
                    testSignal = new index_ts_1.State('initial');
                    cleanup = (0, index_ts_1.createEffect)(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    result = (0, index_ts_1.resolve)({ testSignal: testSignal });
                                    if (!result.ok)
                                        return [2 /*return*/];
                                    return [4 /*yield*/, wait(30)];
                                case 1:
                                    _a.sent();
                                    asyncEffectCompleted = true;
                                    return [2 /*return*/, function () {
                                            cleanupRegistered = true;
                                        }];
                            }
                        });
                    }); });
                    // Wait for async effect to complete
                    return [4 /*yield*/, wait(50)];
                case 1:
                    // Wait for async effect to complete
                    _a.sent();
                    (0, bun_test_1.expect)(asyncEffectCompleted).toBe(true);
                    cleanup();
                    (0, bun_test_1.expect)(cleanupRegistered).toBe(true);
                    (0, bun_test_1.expect)(cleanup).toBeInstanceOf(Function);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle rapid signal changes with concurrent async operations', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testSignal, completedOperations, abortedOperations;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testSignal = new index_ts_1.State(0);
                    completedOperations = 0;
                    abortedOperations = 0;
                    (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        var result, error_3;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    result = (0, index_ts_1.resolve)({ testSignal: testSignal });
                                    if (!result.ok)
                                        return [2 /*return*/];
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, wait(30)];
                                case 2:
                                    _a.sent();
                                    if (!abort.aborted) {
                                        completedOperations++;
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_3 = _a.sent();
                                    if (error_3 instanceof DOMException &&
                                        error_3.name === 'AbortError') {
                                        abortedOperations++;
                                    }
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Rapidly change signal multiple times
                    testSignal.set(1);
                    return [4 /*yield*/, wait(5)];
                case 1:
                    _a.sent();
                    testSignal.set(2);
                    return [4 /*yield*/, wait(5)];
                case 2:
                    _a.sent();
                    testSignal.set(3);
                    return [4 /*yield*/, wait(5)];
                case 3:
                    _a.sent();
                    testSignal.set(4);
                    // Wait for all operations to complete or abort
                    return [4 /*yield*/, wait(60)
                        // Only the last operation should complete
                    ];
                case 4:
                    // Wait for all operations to complete or abort
                    _a.sent();
                    // Only the last operation should complete
                    (0, bun_test_1.expect)(completedOperations).toBe(1);
                    (0, bun_test_1.expect)(abortedOperations).toBe(0); // AbortError is handled gracefully, not thrown
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle async errors that are not AbortError', function () { return __awaiter(void 0, void 0, void 0, function () {
        var originalConsoleError, mockConsoleError, testSignal_2, errorThrower_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    originalConsoleError = console.error;
                    mockConsoleError = (0, bun_test_1.mock)(function () { });
                    console.error = mockConsoleError;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    testSignal_2 = new index_ts_1.State(1);
                    errorThrower_1 = new index_ts_1.Memo(function () {
                        var value = testSignal_2.get();
                        if (value > 5)
                            throw new Error('Value too high');
                        return value;
                    });
                    (0, index_ts_1.createEffect)(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var result;
                        return __generator(this, function (_a) {
                            result = (0, index_ts_1.resolve)({ errorThrower: errorThrower_1 });
                            if (result.ok) {
                                // Normal operation
                            }
                            else if (result.errors) {
                                // Handle errors from resolve
                                (0, bun_test_1.expect)(result.errors[0].message).toBe('Value too high');
                                return [2 /*return*/];
                            }
                            // Simulate an async error that's not an AbortError
                            if (result.ok && result.values.errorThrower > 3) {
                                throw new Error('Async processing error');
                            }
                            return [2 /*return*/];
                        });
                    }); });
                    testSignal_2.set(4); // This will cause an async error
                    return [4 /*yield*/, wait(20)
                        // Should have logged the async error
                    ];
                case 2:
                    _a.sent();
                    // Should have logged the async error
                    (0, bun_test_1.expect)(mockConsoleError).toHaveBeenCalledWith('Error in async effect callback:', bun_test_1.expect.any(Error));
                    return [3 /*break*/, 4];
                case 3:
                    console.error = originalConsoleError;
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should handle promise-based async effects', function () { return __awaiter(void 0, void 0, void 0, function () {
        var promiseResolved, effectValue, testSignal;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promiseResolved = false;
                    effectValue = '';
                    testSignal = new index_ts_1.State('test-value');
                    (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        var result;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    result = (0, index_ts_1.resolve)({ testSignal: testSignal });
                                    if (!result.ok)
                                        return [2 /*return*/];
                                    // Simulate async work that respects abort signal
                                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                                            var timeout = setTimeout(function () {
                                                effectValue = result.values.testSignal;
                                                promiseResolved = true;
                                                resolve();
                                            }, 40);
                                            abort.addEventListener('abort', function () {
                                                clearTimeout(timeout);
                                                reject(new DOMException('Aborted', 'AbortError'));
                                            });
                                        })];
                                case 1:
                                    // Simulate async work that respects abort signal
                                    _a.sent();
                                    return [2 /*return*/, function () {
                                            // Cleanup function
                                        }];
                            }
                        });
                    }); });
                    return [4 /*yield*/, wait(60)];
                case 1:
                    _a.sent();
                    (0, bun_test_1.expect)(promiseResolved).toBe(true);
                    (0, bun_test_1.expect)(effectValue).toBe('test-value');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should not create AbortController for sync functions', function () {
        var testSignal = new index_ts_1.State('test');
        var syncCallCount = 0;
        // Mock AbortController constructor to detect if it's called
        var originalAbortController = globalThis.AbortController;
        var abortControllerCreated = false;
        globalThis.AbortController = /** @class */ (function (_super) {
            __extends(AbortController, _super);
            function AbortController() {
                var _this = _super.call(this) || this;
                abortControllerCreated = true;
                return _this;
            }
            return AbortController;
        }(originalAbortController));
        try {
            (0, index_ts_1.createEffect)(function () {
                var result = (0, index_ts_1.resolve)({ testSignal: testSignal });
                if (result.ok) {
                    syncCallCount++;
                }
            });
            testSignal.set('changed');
            (0, bun_test_1.expect)(syncCallCount).toBe(2);
            (0, bun_test_1.expect)(abortControllerCreated).toBe(false);
        }
        finally {
            globalThis.AbortController = originalAbortController;
        }
    });
    (0, bun_test_1.test)('should handle concurrent async operations with abort', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testSignal, operation1Completed, operation1Aborted;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testSignal = new index_ts_1.State(1);
                    operation1Completed = false;
                    operation1Aborted = false;
                    (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        var result, error_4;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    result = (0, index_ts_1.resolve)({ testSignal: testSignal });
                                    if (!result.ok)
                                        return [2 /*return*/];
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    // Create a promise that can be aborted
                                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                                            var timeout = setTimeout(function () {
                                                operation1Completed = true;
                                                resolve();
                                            }, 80);
                                            abort.addEventListener('abort', function () {
                                                operation1Aborted = true;
                                                clearTimeout(timeout);
                                                reject(new DOMException('Aborted', 'AbortError'));
                                            });
                                        })];
                                case 2:
                                    // Create a promise that can be aborted
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_4 = _a.sent();
                                    if (error_4 instanceof DOMException &&
                                        error_4.name === 'AbortError') {
                                        // Expected when aborted
                                        return [2 /*return*/];
                                    }
                                    throw error_4;
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Start first operation
                    return [4 /*yield*/, wait(20)
                        // Trigger second operation before first completes
                    ];
                case 1:
                    // Start first operation
                    _a.sent();
                    // Trigger second operation before first completes
                    testSignal.set(2);
                    // Wait a bit for abort to take effect
                    return [4 /*yield*/, wait(30)];
                case 2:
                    // Wait a bit for abort to take effect
                    _a.sent();
                    (0, bun_test_1.expect)(operation1Aborted).toBe(true);
                    (0, bun_test_1.expect)(operation1Completed).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
});
(0, bun_test_1.describe)('Effect + Resolve Integration', function () {
    (0, bun_test_1.test)('should work with resolve discriminated union', function () {
        var a = new index_ts_1.State(10);
        var b = new index_ts_1.State('hello');
        var effectRan = false;
        (0, index_ts_1.createEffect)(function () {
            var result = (0, index_ts_1.resolve)({ a: a, b: b });
            if (result.ok) {
                effectRan = true;
                (0, bun_test_1.expect)(result.values.a).toBe(10);
                (0, bun_test_1.expect)(result.values.b).toBe('hello');
            }
        });
        (0, bun_test_1.expect)(effectRan).toBe(true);
    });
    (0, bun_test_1.test)('should work with match function', function () {
        var a = new index_ts_1.State(42);
        var matchedValue = 0;
        (0, index_ts_1.createEffect)(function () {
            var result = (0, index_ts_1.resolve)({ a: a });
            (0, index_ts_1.match)(result, {
                ok: function (values) {
                    matchedValue = values.a;
                },
            });
        });
        (0, bun_test_1.expect)(matchedValue).toBe(42);
    });
});
(0, bun_test_1.describe)('Effect - Race Conditions and Consistency', function () {
    (0, bun_test_1.test)('should handle race conditions between abort and cleanup properly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testSignal, cleanupCallCount, abortCallCount, operationCount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testSignal = new index_ts_1.State(0);
                    cleanupCallCount = 0;
                    abortCallCount = 0;
                    operationCount = 0;
                    (0, index_ts_1.createEffect)(function (abort) { return __awaiter(void 0, void 0, void 0, function () {
                        var error_5;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    testSignal.get();
                                    ++operationCount;
                                    abort.addEventListener('abort', function () {
                                        abortCallCount++;
                                    });
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, wait(50)
                                        // This cleanup should only be registered if the operation wasn't aborted
                                    ];
                                case 2:
                                    _a.sent();
                                    // This cleanup should only be registered if the operation wasn't aborted
                                    return [2 /*return*/, function () {
                                            cleanupCallCount++;
                                        }];
                                case 3:
                                    error_5 = _a.sent();
                                    if (!(0, index_ts_1.isAbortError)(error_5))
                                        throw error_5;
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Rapid signal changes to test race conditions
                    testSignal.set(1);
                    return [4 /*yield*/, wait(10)];
                case 1:
                    _a.sent();
                    testSignal.set(2);
                    return [4 /*yield*/, wait(10)];
                case 2:
                    _a.sent();
                    testSignal.set(3);
                    return [4 /*yield*/, wait(100)
                        // Without proper abort handling, we might get multiple cleanups
                    ]; // Let all operations complete
                case 3:
                    _a.sent(); // Let all operations complete
                    // Without proper abort handling, we might get multiple cleanups
                    (0, bun_test_1.expect)(cleanupCallCount).toBeLessThanOrEqual(1); // Should be at most 1
                    (0, bun_test_1.expect)(operationCount).toBeGreaterThan(1); // Should have multiple operations
                    (0, bun_test_1.expect)(abortCallCount).toBeGreaterThan(0); // Should have some aborts
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should demonstrate difference in abort handling between computed and effect', function () { return __awaiter(void 0, void 0, void 0, function () {
        var source, computedRetries, effectRuns, comp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    source = new index_ts_1.State(1);
                    computedRetries = 0;
                    effectRuns = 0;
                    comp = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    computedRetries++;
                                    return [4 /*yield*/, wait(30)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, source.get() * 2];
                            }
                        });
                    }); });
                    // Effect without abort listener (current implementation)
                    (0, index_ts_1.createEffect)(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    effectRuns++;
                                    // Must access the source to make effect reactive
                                    source.get();
                                    return [4 /*yield*/, wait(30)];
                                case 1:
                                    _a.sent();
                                    (0, index_ts_1.resolve)({ comp: comp });
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    // Change source rapidly
                    source.set(2);
                    return [4 /*yield*/, wait(10)];
                case 1:
                    _a.sent();
                    source.set(3);
                    return [4 /*yield*/, wait(50)
                        // Computed should retry efficiently due to abort listener
                        // Effect should handle the changes naturally through dependency tracking
                    ];
                case 2:
                    _a.sent();
                    // Computed should retry efficiently due to abort listener
                    // Effect should handle the changes naturally through dependency tracking
                    (0, bun_test_1.expect)(computedRetries).toBeGreaterThan(0);
                    (0, bun_test_1.expect)(effectRuns).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should prevent stale cleanup registration with generation counter approach', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testSignal, cleanupCallCount, effectRunCount, staleCleanupAttempts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testSignal = new index_ts_1.State(0);
                    cleanupCallCount = 0;
                    effectRunCount = 0;
                    staleCleanupAttempts = 0;
                    (0, index_ts_1.createEffect)(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var currentRun, error_6;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    effectRunCount++;
                                    currentRun = effectRunCount;
                                    testSignal.get(); // Make reactive
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, wait(60)
                                        // This cleanup should only be registered for the latest run
                                    ];
                                case 2:
                                    _a.sent();
                                    // This cleanup should only be registered for the latest run
                                    return [2 /*return*/, function () {
                                            cleanupCallCount++;
                                            if (currentRun !== effectRunCount) {
                                                staleCleanupAttempts++;
                                            }
                                        }];
                                case 3:
                                    error_6 = _a.sent();
                                    if (!(0, index_ts_1.isAbortError)(error_6))
                                        throw error_6;
                                    return [2 /*return*/, undefined];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    // Trigger multiple rapid changes
                    testSignal.set(1);
                    return [4 /*yield*/, wait(20)];
                case 1:
                    _a.sent();
                    testSignal.set(2);
                    return [4 /*yield*/, wait(20)];
                case 2:
                    _a.sent();
                    testSignal.set(3);
                    return [4 /*yield*/, wait(80)
                        // Should have multiple runs but only one cleanup (from the last successful run)
                    ]; // Let final operation complete
                case 3:
                    _a.sent(); // Let final operation complete
                    // Should have multiple runs but only one cleanup (from the last successful run)
                    (0, bun_test_1.expect)(effectRunCount).toBeGreaterThan(1);
                    (0, bun_test_1.expect)(cleanupCallCount).toBeLessThanOrEqual(1);
                    (0, bun_test_1.expect)(staleCleanupAttempts).toBe(0); // No stale cleanups should be registered
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should demonstrate why computed needs immediate retry via abort listener', function () { return __awaiter(void 0, void 0, void 0, function () {
        var source, computeAttempts, finalValue, comp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    source = new index_ts_1.State(1);
                    computeAttempts = 0;
                    finalValue = 0;
                    comp = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    computeAttempts++;
                                    return [4 /*yield*/, wait(30)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, source.get() * 2];
                            }
                        });
                    }); });
                    // Start computation
                    (0, bun_test_1.expect)(comp.get()).toBe(index_ts_1.UNSET);
                    // Change source during computation - this should trigger immediate retry
                    return [4 /*yield*/, wait(10)];
                case 1:
                    // Change source during computation - this should trigger immediate retry
                    _a.sent();
                    source.set(5);
                    // Wait for computation to complete
                    return [4 /*yield*/, wait(50)];
                case 2:
                    // Wait for computation to complete
                    _a.sent();
                    finalValue = comp.get();
                    // The abort listener allows immediate retry, so we should get the latest value
                    (0, bun_test_1.expect)(finalValue).toBe(10); // 5 * 2
                    // Note: The number of attempts can vary due to timing, but should get correct result
                    (0, bun_test_1.expect)(computeAttempts).toBeGreaterThanOrEqual(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
