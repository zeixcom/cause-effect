"use strict";
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
exports.createStore = exports.isStore = exports.TYPE_STORE = void 0;
var diff_1 = require("../src/diff");
var errors_1 = require("../src/errors");
var signal_1 = require("../src/signal");
var system_1 = require("../src/system");
var util_1 = require("../src/util");
var computed_1 = require("./computed");
var list_1 = require("./list");
var state_1 = require("./state");
/* === Constants === */
var TYPE_STORE = 'Store';
exports.TYPE_STORE = TYPE_STORE;
/* === Functions === */
/**
 * Create a new store with deeply nested reactive properties
 *
 * Supports both objects and arrays as initial values. Arrays are converted
 * to records internally for storage but maintain their array type through
 * the .get() method, which automatically converts objects with consecutive
 * numeric keys back to arrays.
 *
 * For array-like stores, an optional keyConfig parameter can be provided to
 * generate stable keys for array items. This creates persistent references
 * that remain stable across sort and compact operations.
 *
 * @since 0.15.0
 * @param {T} initialValue - initial object or array value of the store
 * @returns {Store<T>} - new store with reactive properties that preserves the original type T
 */
var createStore = function (initialValue) {
    var _a;
    if (initialValue == null)
        throw new errors_1.NullishSignalValueError('store');
    var watchers = new Set();
    var signals = new Map();
    var ownWatchers = new Map();
    // Get current record
    var current = function () {
        var record = {};
        for (var _i = 0, signals_1 = signals; _i < signals_1.length; _i++) {
            var _a = signals_1[_i], key = _a[0], signal = _a[1];
            record[key] = signal.get();
        }
        return record;
    };
    // Validate input
    var isValidValue = function (key, value) {
        if (value == null)
            throw new errors_1.NullishSignalValueError("store for key \"".concat(key, "\""));
        if (value === system_1.UNSET)
            return true;
        if ((0, util_1.isSymbol)(value) || (0, util_1.isFunction)(value) || (0, computed_1.isComputed)(value))
            throw new errors_1.InvalidSignalValueError("store for key \"".concat(key, "\""), value);
        return true;
    };
    // Add nested signal and effect
    var addProperty = function (key, value, single) {
        if (single === void 0) { single = false; }
        if (!isValidValue(key, value))
            return false;
        // Create signal for key
        // @ts-expect-error non-matching signal types
        var signal = (0, state_1.isState)(value) || isStore(value) || (0, list_1.isList)(value)
            ? value
            : (0, util_1.isRecord)(value)
                ? createStore(value)
                : Array.isArray(value)
                    ? (0, list_1.createList)(value)
                    : (0, state_1.createState)(value);
        // Set internal states
        // @ts-expect-error non-matching signal types
        signals.set(key, signal);
        if (single) {
            (0, system_1.notifyWatchers)(watchers);
        }
        return true;
    };
    // Remove nested signal and effect
    var removeProperty = function (key, single) {
        if (single === void 0) { single = false; }
        // Remove signal for key
        var ok = signals.delete(key);
        if (!ok)
            return;
        // Clean up internal states
        var watcher = ownWatchers.get(key);
        if (watcher) {
            watcher.stop();
            ownWatchers.delete(key);
        }
        if (single) {
            (0, system_1.notifyWatchers)(watchers);
        }
    };
    // Commit batched changes and emit notifications
    var batchChanges = function (changes) {
        // Additions
        if (Object.keys(changes.add).length) {
            for (var key in changes.add)
                addProperty(key, changes.add[key], false);
        }
        // Changes
        if (Object.keys(changes.change).length) {
            (0, system_1.batch)(function () {
                for (var key in changes.change) {
                    var value = changes.change[key];
                    if (!isValidValue(key, value))
                        continue;
                    var signal = signals.get(key);
                    if ((0, signal_1.isMutableSignal)(signal))
                        signal.set(value);
                    else
                        throw new errors_1.ReadonlySignalError(key, value);
                }
            });
        }
        // Removals
        if (Object.keys(changes.remove).length) {
            for (var key in changes.remove)
                removeProperty(key);
        }
        return changes.changed;
    };
    // Reconcile data and dispatch events
    var reconcile = function (oldValue, newValue) {
        return batchChanges((0, diff_1.diff)(oldValue, newValue));
    };
    // Initialize data
    reconcile({}, initialValue);
    // Methods and Properties
    var prototype = {};
    Object.defineProperties(prototype, (_a = {},
        _a[Symbol.toStringTag] = {
            value: TYPE_STORE,
        },
        _a[Symbol.iterator] = {
            value: function () {
                var _i, signals_2, _a, key, signal;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _i = 0, signals_2 = signals;
                            _b.label = 1;
                        case 1:
                            if (!(_i < signals_2.length)) return [3 /*break*/, 4];
                            _a = signals_2[_i], key = _a[0], signal = _a[1];
                            return [4 /*yield*/, [key, signal]];
                        case 2:
                            _b.sent();
                            _b.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/];
                    }
                });
            },
        },
        _a.add = {
            value: function (key, value) {
                if (signals.has(key))
                    throw new errors_1.DuplicateKeyError('store', key, value);
                addProperty(key, value, true);
                return key;
            },
        },
        _a.byKey = {
            value: function (key) {
                return signals.get(key);
            },
        },
        _a.get = {
            value: function () {
                (0, system_1.subscribeActiveWatcher)(watchers);
                return current();
            },
        },
        _a.remove = {
            value: function (key) {
                if (signals.has(key))
                    removeProperty(key, true);
            },
        },
        _a.set = {
            value: function (newValue) {
                if (reconcile(current(), newValue)) {
                    (0, system_1.notifyWatchers)(watchers);
                    if (system_1.UNSET === newValue)
                        watchers.clear();
                }
            },
        },
        _a.update = {
            value: function (fn) {
                store.set(fn(current()));
            },
        },
        _a));
    // Return proxy directly with integrated signal methods
    var store = new Proxy(prototype, {
        get: function (target, prop) {
            if (prop in target)
                return Reflect.get(target, prop);
            if (!(0, util_1.isSymbol)(prop))
                return signals.get(prop);
        },
        has: function (target, prop) {
            if (prop in target)
                return true;
            return signals.has(String(prop));
        },
        ownKeys: function (target) {
            var staticKeys = Reflect.ownKeys(target);
            return __spreadArray([], new Set(__spreadArray(__spreadArray([], signals.keys(), true), staticKeys, true)), true);
        },
        getOwnPropertyDescriptor: function (target, prop) {
            if (prop in target)
                return Reflect.getOwnPropertyDescriptor(target, prop);
            if ((0, util_1.isSymbol)(prop))
                return undefined;
            var signal = signals.get(prop);
            return signal
                ? {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: signal,
                }
                : undefined;
        },
    });
    return store;
};
exports.createStore = createStore;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
var isStore = function (value) {
    return (0, util_1.isObjectOfType)(value, TYPE_STORE);
};
exports.isStore = isStore;
