"use strict";
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
/* === Tests === */
(0, bun_test_1.describe)('Match Function', function () {
    (0, bun_test_1.test)('should call ok handler for successful resolution', function () {
        var a = new index_ts_1.State(10);
        var b = new index_ts_1.State('hello');
        var okCalled = false;
        var okValues = null;
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ a: a, b: b }), {
            ok: function (values) {
                okCalled = true;
                okValues = values;
            },
            err: function () {
                throw new Error('Should not be called');
            },
            nil: function () {
                throw new Error('Should not be called');
            },
        });
        (0, bun_test_1.expect)(okCalled).toBe(true);
        (0, bun_test_1.expect)(okValues).toBeTruthy();
        (0, bun_test_1.expect)(okValues.a).toBe(10);
        (0, bun_test_1.expect)(okValues.b).toBe('hello');
    });
    (0, bun_test_1.test)('should call nil handler for pending signals', function () {
        var a = new index_ts_1.State(10);
        var b = new index_ts_1.State(index_ts_1.UNSET);
        var nilCalled = false;
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ a: a, b: b }), {
            ok: function () {
                throw new Error('Should not be called');
            },
            err: function () {
                throw new Error('Should not be called');
            },
            nil: function () {
                nilCalled = true;
            },
        });
        (0, bun_test_1.expect)(nilCalled).toBe(true);
    });
    (0, bun_test_1.test)('should call error handler for error signals', function () {
        var a = new index_ts_1.State(10);
        var b = new index_ts_1.Memo(function () {
            throw new Error('Test error');
        });
        var errCalled = false;
        var errValue = null;
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ a: a, b: b }), {
            ok: function () {
                throw new Error('Should not be called');
            },
            err: function (errors) {
                errCalled = true;
                errValue = errors[0];
            },
            nil: function () {
                throw new Error('Should not be called');
            },
        });
        (0, bun_test_1.expect)(errCalled).toBe(true);
        (0, bun_test_1.expect)(errValue).toBeTruthy();
        (0, bun_test_1.expect)(errValue.message).toBe('Test error');
    });
    (0, bun_test_1.test)('should handle missing optional handlers gracefully', function () {
        var a = new index_ts_1.State(10);
        var result = (0, index_ts_1.resolve)({ a: a });
        // Should not throw even with only required ok handler (err and nil are optional)
        (0, bun_test_1.expect)(function () {
            (0, index_ts_1.match)(result, {
                ok: function () {
                    // This handler is required, but err and nil are optional
                },
            });
        }).not.toThrow();
    });
    (0, bun_test_1.test)('should return void always', function () {
        var a = new index_ts_1.State(42);
        var returnValue = (0, index_ts_1.match)((0, index_ts_1.resolve)({ a: a }), {
            ok: function () {
                // Even if we try to return something, match should return void
                return 'something';
            },
        });
        (0, bun_test_1.expect)(returnValue).toBeUndefined();
    });
    (0, bun_test_1.test)('should handle handler errors by calling error handler', function () {
        var a = new index_ts_1.State(10);
        var handlerErrorCalled = false;
        var handlerError = null;
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ a: a }), {
            ok: function () {
                throw new Error('Handler error');
            },
            err: function (errors) {
                handlerErrorCalled = true;
                handlerError = errors[errors.length - 1]; // Last error should be the handler error
            },
        });
        (0, bun_test_1.expect)(handlerErrorCalled).toBe(true);
        (0, bun_test_1.expect)(handlerError).toBeTruthy();
        (0, bun_test_1.expect)(handlerError.message).toBe('Handler error');
    });
    (0, bun_test_1.test)('should rethrow handler errors if no error handler available', function () {
        var a = new index_ts_1.State(10);
        (0, bun_test_1.expect)(function () {
            (0, index_ts_1.match)((0, index_ts_1.resolve)({ a: a }), {
                ok: function () {
                    throw new Error('Handler error');
                },
            });
        }).toThrow('Handler error');
    });
    (0, bun_test_1.test)('should combine existing errors with handler errors', function () {
        var a = new index_ts_1.Memo(function () {
            throw new Error('Signal error');
        });
        var allErrors = null;
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ a: a }), {
            ok: function () {
                // This won't be called since there are errors, but it's required
            },
            err: function (errors) {
                // First call with signal error
                if (errors.length === 1) {
                    throw new Error('Handler error');
                }
                // Second call with both errors
                allErrors = errors;
            },
        });
        (0, bun_test_1.expect)(allErrors).toBeTruthy();
        (0, bun_test_1.expect)(allErrors.length).toBe(2);
        (0, bun_test_1.expect)(allErrors[0].message).toBe('Signal error');
        (0, bun_test_1.expect)(allErrors[1].message).toBe('Handler error');
    });
    (0, bun_test_1.test)('should work with complex type inference', function () {
        var user = new index_ts_1.State({ id: 1, name: 'Alice' });
        var posts = new index_ts_1.State([{ id: 1, title: 'Hello' }]);
        var settings = new index_ts_1.State({ theme: 'dark' });
        var typeTestPassed = false;
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ user: user, posts: posts, settings: settings }), {
            ok: function (values) {
                // TypeScript should infer these types perfectly
                var userId = values.user.id;
                var userName = values.user.name;
                var firstPost = values.posts[0];
                var postTitle = firstPost.title;
                var theme = values.settings.theme;
                (0, bun_test_1.expect)(userId).toBe(1);
                (0, bun_test_1.expect)(userName).toBe('Alice');
                (0, bun_test_1.expect)(postTitle).toBe('Hello');
                (0, bun_test_1.expect)(theme).toBe('dark');
                typeTestPassed = true;
            },
        });
        (0, bun_test_1.expect)(typeTestPassed).toBe(true);
    });
    (0, bun_test_1.test)('should handle side effects only pattern', function () {
        var count = new index_ts_1.State(5);
        var name = new index_ts_1.State('test');
        var sideEffectExecuted = false;
        var capturedData = '';
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ count: count, name: name }), {
            ok: function (values) {
                // Pure side effect - no return value expected
                sideEffectExecuted = true;
                capturedData = "".concat(values.name, ": ").concat(values.count);
                // Even if we try to return something, it should be ignored
                return 'ignored';
            },
        });
        (0, bun_test_1.expect)(sideEffectExecuted).toBe(true);
        (0, bun_test_1.expect)(capturedData).toBe('test: 5');
    });
    (0, bun_test_1.test)('should handle multiple error types correctly', function () {
        var error1 = new index_ts_1.Memo(function () {
            throw new Error('First error');
        });
        var error2 = new index_ts_1.Memo(function () {
            throw new Error('Second error');
        });
        var errorMessages = [];
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ error1: error1, error2: error2 }), {
            ok: function () {
                // This won't be called since there are errors, but it's required
            },
            err: function (errors) {
                errorMessages = errors.map(function (e) { return e.message; });
            },
        });
        (0, bun_test_1.expect)(errorMessages).toHaveLength(2);
        (0, bun_test_1.expect)(errorMessages).toContain('First error');
        (0, bun_test_1.expect)(errorMessages).toContain('Second error');
    });
    (0, bun_test_1.test)('should work with async computed signals', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wait, asyncSignal, pendingCalled, okCalled, finalValue, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wait = function (ms) {
                        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
                    };
                    asyncSignal = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, wait(10)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, 'async result'];
                            }
                        });
                    }); });
                    pendingCalled = false;
                    okCalled = false;
                    finalValue = '';
                    result = (0, index_ts_1.resolve)({ asyncSignal: asyncSignal });
                    (0, index_ts_1.match)(result, {
                        ok: function (values) {
                            okCalled = true;
                            finalValue = values.asyncSignal;
                        },
                        nil: function () {
                            pendingCalled = true;
                        },
                    });
                    (0, bun_test_1.expect)(pendingCalled).toBe(true);
                    (0, bun_test_1.expect)(okCalled).toBe(false);
                    // Wait for resolution
                    return [4 /*yield*/, wait(20)];
                case 1:
                    // Wait for resolution
                    _a.sent();
                    result = (0, index_ts_1.resolve)({ asyncSignal: asyncSignal });
                    (0, index_ts_1.match)(result, {
                        ok: function (values) {
                            okCalled = true;
                            finalValue = values.asyncSignal;
                        },
                    });
                    (0, bun_test_1.expect)(okCalled).toBe(true);
                    (0, bun_test_1.expect)(finalValue).toBe('async result');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, bun_test_1.test)('should maintain referential transparency', function () {
        var a = new index_ts_1.State(42);
        var result = (0, index_ts_1.resolve)({ a: a });
        var callCount = 0;
        // Calling match multiple times with same result should be consistent
        (0, index_ts_1.match)(result, {
            ok: function () {
                callCount++;
            },
        });
        (0, index_ts_1.match)(result, {
            ok: function () {
                callCount++;
            },
        });
        (0, bun_test_1.expect)(callCount).toBe(2);
    });
});
(0, bun_test_1.describe)('Match Function Integration', function () {
    (0, bun_test_1.test)('should work seamlessly with resolve', function () {
        var data = new index_ts_1.State({ id: 1, value: 'test' });
        var processed = false;
        var processedValue = '';
        (0, index_ts_1.match)((0, index_ts_1.resolve)({ data: data }), {
            ok: function (values) {
                processed = true;
                processedValue = values.data.value;
            },
        });
        (0, bun_test_1.expect)(processed).toBe(true);
        (0, bun_test_1.expect)(processedValue).toBe('test');
    });
    (0, bun_test_1.test)('should handle real-world scenario with mixed states', function () { return __awaiter(void 0, void 0, void 0, function () {
        var wait, syncData, asyncData, errorData, pendingCount, errorCount, successCount, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wait = function (ms) {
                        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
                    };
                    syncData = new index_ts_1.State('available');
                    asyncData = new index_ts_1.Task(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, wait(10)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, 'loaded'];
                            }
                        });
                    }); });
                    errorData = new index_ts_1.Memo(function () {
                        throw new Error('Failed to load');
                    });
                    pendingCount = 0;
                    errorCount = 0;
                    successCount = 0;
                    result = (0, index_ts_1.resolve)({ syncData: syncData, asyncData: asyncData });
                    (0, index_ts_1.match)(result, {
                        ok: function () { return successCount++; },
                        err: function () { return errorCount++; },
                        nil: function () { return pendingCount++; },
                    });
                    (0, bun_test_1.expect)(pendingCount).toBe(1);
                    // Should have errors when including error signal
                    result = (0, index_ts_1.resolve)({ syncData: syncData, asyncData: asyncData, errorData: errorData });
                    (0, index_ts_1.match)(result, {
                        ok: function () { return successCount++; },
                        err: function () { return errorCount++; },
                        nil: function () { return pendingCount++; },
                    });
                    (0, bun_test_1.expect)(pendingCount).toBe(2); // Still pending due to async
                    // Wait for async to resolve
                    return [4 /*yield*/, wait(20)
                        // Should succeed with just sync and async
                    ];
                case 1:
                    // Wait for async to resolve
                    _a.sent();
                    // Should succeed with just sync and async
                    result = (0, index_ts_1.resolve)({ syncData: syncData, asyncData: asyncData });
                    (0, index_ts_1.match)(result, {
                        ok: function (values) {
                            successCount++;
                            (0, bun_test_1.expect)(values.syncData).toBe('available');
                            (0, bun_test_1.expect)(values.asyncData).toBe('loaded');
                        },
                        err: function () { return errorCount++; },
                        nil: function () { return pendingCount++; },
                    });
                    // Should error when including error signal
                    result = (0, index_ts_1.resolve)({ syncData: syncData, asyncData: asyncData, errorData: errorData });
                    (0, index_ts_1.match)(result, {
                        ok: function () { return successCount++; },
                        err: function (errors) {
                            errorCount++;
                            (0, bun_test_1.expect)(errors[0].message).toBe('Failed to load');
                        },
                        nil: function () { return pendingCount++; },
                    });
                    (0, bun_test_1.expect)(successCount).toBe(1);
                    (0, bun_test_1.expect)(errorCount).toBe(1);
                    (0, bun_test_1.expect)(pendingCount).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); });
});
