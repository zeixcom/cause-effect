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
var ref_1 = require("../src/classes/ref");
var effect_1 = require("../src/effect");
(0, bun_test_1.test)('Ref - basic functionality', function () {
    var obj = { name: 'test', value: 42 };
    var ref = new ref_1.Ref(obj);
    (0, bun_test_1.expect)(ref.get()).toBe(obj);
    (0, bun_test_1.expect)(ref[Symbol.toStringTag]).toBe('Ref');
});
(0, bun_test_1.test)('Ref - isRef type guard', function () {
    var ref = new ref_1.Ref({ test: true });
    var notRef = { test: true };
    (0, bun_test_1.expect)((0, ref_1.isRef)(ref)).toBe(true);
    (0, bun_test_1.expect)((0, ref_1.isRef)(notRef)).toBe(false);
    (0, bun_test_1.expect)((0, ref_1.isRef)(null)).toBe(false);
    (0, bun_test_1.expect)((0, ref_1.isRef)(undefined)).toBe(false);
});
(0, bun_test_1.test)('Ref - validation with guard function', function () {
    var isConfig = function (value) {
        return typeof value === 'object' &&
            value !== null &&
            'host' in value &&
            'port' in value &&
            typeof value.host === 'string' &&
            typeof value.port === 'number';
    };
    var validConfig = { host: 'localhost', port: 3000 };
    var invalidConfig = { host: 'localhost' }; // missing port
    (0, bun_test_1.expect)(function () { return new ref_1.Ref(validConfig, { guard: isConfig }); }).not.toThrow();
    (0, bun_test_1.expect)(function () { return new ref_1.Ref(invalidConfig, { guard: isConfig }); }).toThrow();
});
(0, bun_test_1.test)('Ref - reactive subscriptions', function () {
    var server = { status: 'offline', connections: 0 };
    var ref = new ref_1.Ref(server);
    var effectRunCount = 0;
    var lastStatus = '';
    (0, effect_1.createEffect)(function () {
        var current = ref.get();
        lastStatus = current.status;
        effectRunCount++;
    });
    (0, bun_test_1.expect)(effectRunCount).toBe(1);
    (0, bun_test_1.expect)(lastStatus).toBe('offline');
    // Simulate external change without going through reactive system
    server.status = 'online';
    server.connections = 5;
    // Effect shouldn't re-run yet (reference hasn't changed)
    (0, bun_test_1.expect)(effectRunCount).toBe(1);
    // Notify that the external object has changed
    ref.notify();
    (0, bun_test_1.expect)(effectRunCount).toBe(2);
    (0, bun_test_1.expect)(lastStatus).toBe('online');
});
(0, bun_test_1.test)('Ref - notify triggers watchers even with same reference', function () {
    var fileObj = { path: '/test.txt', size: 100, modified: Date.now() };
    var ref = new ref_1.Ref(fileObj);
    var mockCallback = (0, bun_test_1.mock)(function () { });
    (0, effect_1.createEffect)(function () {
        ref.get();
        mockCallback();
    });
    (0, bun_test_1.expect)(mockCallback).toHaveBeenCalledTimes(1);
    // Simulate file modification (same object reference, different content)
    fileObj.size = 200;
    fileObj.modified = Date.now();
    // Notify about external change
    ref.notify();
    (0, bun_test_1.expect)(mockCallback).toHaveBeenCalledTimes(2);
    // Multiple notifies should trigger multiple times
    ref.notify();
    (0, bun_test_1.expect)(mockCallback).toHaveBeenCalledTimes(3);
});
(0, bun_test_1.test)('Ref - multiple effects with same ref', function () {
    var database = { connected: false, queries: 0 };
    var ref = new ref_1.Ref(database);
    var effect1Mock = (0, bun_test_1.mock)(function () { });
    var effect2Mock = (0, bun_test_1.mock)(function (_connected) { });
    (0, effect_1.createEffect)(function () {
        ref.get();
        effect1Mock();
    });
    (0, effect_1.createEffect)(function () {
        var db = ref.get();
        effect2Mock(db.connected);
    });
    (0, bun_test_1.expect)(effect1Mock).toHaveBeenCalledTimes(1);
    (0, bun_test_1.expect)(effect2Mock).toHaveBeenCalledTimes(1);
    (0, bun_test_1.expect)(effect2Mock).toHaveBeenCalledWith(false);
    // Simulate database connection change
    database.connected = true;
    database.queries = 10;
    ref.notify();
    (0, bun_test_1.expect)(effect1Mock).toHaveBeenCalledTimes(2);
    (0, bun_test_1.expect)(effect2Mock).toHaveBeenCalledTimes(2);
    (0, bun_test_1.expect)(effect2Mock).toHaveBeenLastCalledWith(true);
});
(0, bun_test_1.test)('Ref - with Bun.file() scenario', function () {
    // Mock a file-like object that could change externally
    var fileRef = {
        name: 'config.json',
        size: 1024,
        lastModified: Date.now(),
        // Simulate file methods
        exists: function () { return true; },
        text: function () { return Promise.resolve('{"version": "1.0"}'); },
    };
    var ref = new ref_1.Ref(fileRef);
    var sizeChanges = 0;
    (0, effect_1.createEffect)(function () {
        var file = ref.get();
        if (file.size > 1000)
            sizeChanges++;
    });
    (0, bun_test_1.expect)(sizeChanges).toBe(1); // Initial run
    // Simulate file growing (external change)
    fileRef.size = 2048;
    fileRef.lastModified = Date.now();
    ref.notify();
    (0, bun_test_1.expect)(sizeChanges).toBe(2); // Effect re-ran and condition still met
    // Simulate file shrinking
    fileRef.size = 500;
    ref.notify();
    (0, bun_test_1.expect)(sizeChanges).toBe(2); // Effect re-ran but condition no longer met
});
(0, bun_test_1.test)('Ref - validation errors', function () {
    // @ts-expect-error deliberatly provoked error
    (0, bun_test_1.expect)(function () { return new ref_1.Ref(null); }).toThrow();
    // @ts-expect-error deliberatly provoked error
    (0, bun_test_1.expect)(function () { return new ref_1.Ref(undefined); }).toThrow();
});
(0, bun_test_1.test)('Ref - server config object scenario', function () {
    var config = {
        host: 'localhost',
        port: 3000,
        ssl: false,
        maxConnections: 100,
    };
    var configRef = new ref_1.Ref(config);
    var connectionAttempts = [];
    (0, effect_1.createEffect)(function () {
        var cfg = configRef.get();
        var protocol = cfg.ssl ? 'https' : 'http';
        connectionAttempts.push("".concat(protocol, "://").concat(cfg.host, ":").concat(cfg.port));
    });
    (0, bun_test_1.expect)(connectionAttempts).toEqual(['http://localhost:3000']);
    // Simulate config reload from file/environment
    config.ssl = true;
    config.port = 8443;
    configRef.notify();
    (0, bun_test_1.expect)(connectionAttempts).toEqual([
        'http://localhost:3000',
        'https://localhost:8443',
    ]);
});
(0, bun_test_1.test)('Ref - handles complex nested objects', function () {
    var apiResponse = {
        status: 200,
        data: {
            users: [{ id: 1, name: 'Alice' }],
            pagination: { page: 1, total: 1 },
        },
        headers: { 'content-type': 'application/json' },
    };
    var ref = new ref_1.Ref(apiResponse);
    var userCount = 0;
    (0, effect_1.createEffect)(function () {
        var response = ref.get();
        userCount = response.data.users.length;
    });
    (0, bun_test_1.expect)(userCount).toBe(1);
    // Simulate API response update
    apiResponse.data.users.push({ id: 2, name: 'Bob' });
    apiResponse.data.pagination.total = 2;
    ref.notify();
    (0, bun_test_1.expect)(userCount).toBe(2);
});
(0, bun_test_1.test)('Ref - options.watched lazy resource management', function () { return __awaiter(void 0, void 0, void 0, function () {
    var counter, intervalId, ref, effectCleanup, counterAfterStop;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                counter = 0;
                ref = new ref_1.Ref(new Date(), {
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
                // 2. Counter should not be running yet
                (0, bun_test_1.expect)(counter).toBe(0);
                // Wait a bit to ensure counter doesn't increment
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
            case 1:
                // Wait a bit to ensure counter doesn't increment
                _a.sent();
                (0, bun_test_1.expect)(counter).toBe(0);
                (0, bun_test_1.expect)(intervalId).toBeUndefined();
                effectCleanup = (0, effect_1.createEffect)(function () {
                    ref.get();
                });
                // 4. Counter should now be running
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
            case 2:
                // 4. Counter should now be running
                _a.sent();
                (0, bun_test_1.expect)(counter).toBeGreaterThan(0);
                (0, bun_test_1.expect)(intervalId).toBeDefined();
                // 5. Call effect cleanup, which should stop internal watcher and unsubscribe
                effectCleanup();
                counterAfterStop = counter;
                // 6. Ref signal should call #unwatch() and counter should stop incrementing
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
            case 3:
                // 6. Ref signal should call #unwatch() and counter should stop incrementing
                _a.sent();
                (0, bun_test_1.expect)(counter).toBe(counterAfterStop); // Counter should not have incremented
                (0, bun_test_1.expect)(intervalId).toBeUndefined(); // Interval should be cleared
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)('Ref - options.watched exception handling', function () { return __awaiter(void 0, void 0, void 0, function () {
    var ref, originalError, errorSpy, throwingCallbackCalled, effectCleanup;
    return __generator(this, function (_a) {
        ref = new ref_1.Ref({ test: 'value' }, {
            watched: function () {
                throwingCallbackCalled = true;
                throw new Error('Test error in HOOK_WATCH callback');
            },
        });
        originalError = console.error;
        errorSpy = (0, bun_test_1.mock)(function () { });
        console.error = errorSpy;
        throwingCallbackCalled = false;
        effectCleanup = (0, effect_1.createEffect)(function () {
            ref.get();
        });
        // Both callbacks should have been called despite the exception
        (0, bun_test_1.expect)(throwingCallbackCalled).toBe(true);
        // Error should have been logged
        (0, bun_test_1.expect)(errorSpy).toHaveBeenCalledWith('Error in effect callback:', bun_test_1.expect.any(Error));
        // Cleanup
        effectCleanup();
        console.error = originalError;
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)('Ref - options.unwatched exception handling', function () { return __awaiter(void 0, void 0, void 0, function () {
    var ref, originalError, errorSpy, cleanup1Called, effectCleanup;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ref = new ref_1.Ref({ test: 'value' }, {
                    watched: function () { },
                    unwatched: function () {
                        cleanup1Called = true;
                        throw new Error('Test error in cleanup function');
                    },
                });
                originalError = console.error;
                errorSpy = (0, bun_test_1.mock)(function () { });
                console.error = errorSpy;
                cleanup1Called = false;
                effectCleanup = (0, effect_1.createEffect)(function () {
                    ref.get();
                });
                // Unsubscribe to trigger cleanup functions
                effectCleanup();
                // Wait a bit for cleanup to complete
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })
                    // Both cleanup functions should have been called despite the exception
                ];
            case 1:
                // Wait a bit for cleanup to complete
                _a.sent();
                // Both cleanup functions should have been called despite the exception
                (0, bun_test_1.expect)(cleanup1Called).toBe(true);
                // Error should have been logged
                (0, bun_test_1.expect)(errorSpy).toHaveBeenCalledWith('Error in effect cleanup:', bun_test_1.expect.any(Error));
                // Cleanup
                console.error = originalError;
                return [2 /*return*/];
        }
    });
}); });
