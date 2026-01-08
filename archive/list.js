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
exports.createList = exports.isList = exports.TYPE_LIST = void 0;
var diff_1 = require("../src/diff");
var errors_1 = require("../src/errors");
var signal_1 = require("../src/signal");
var system_1 = require("../src/system");
var util_1 = require("../src/util");
var collection_1 = require("./collection");
var computed_1 = require("./computed");
var state_1 = require("./state");
var store_1 = require("./store");
/* === Constants === */
var TYPE_LIST = 'List';
exports.TYPE_LIST = TYPE_LIST;
/* === Functions === */
/**
 * Create a new list with deeply nested reactive list items
 *
 * @since 0.16.2
 * @param {T} initialValue - Initial array of the list
 * @param {KeyConfig<T>} keyConfig - Optional key configuration:
 *   - string: used as prefix for auto-incrementing IDs (e.g., "item" → "item0", "item1")
 *   - function: computes key from array item at creation time
 * @returns {List<T>} - New list with reactive items of type T
 */
var createList = function (initialValue, keyConfig) {
    var _a;
    if (initialValue == null)
        throw new errors_1.NullishSignalValueError('store');
    var watchers = new Set();
    var signals = new Map();
    var ownWatchers = new Map();
    // Stable key support for lists
    var keyCounter = 0;
    var order = [];
    // Get signal by key or index
    var getSignal = function (prop) {
        var _a;
        var key = prop;
        var index = Number(prop);
        if (Number.isInteger(index) && index >= 0)
            key = (_a = order[index]) !== null && _a !== void 0 ? _a : prop;
        return signals.get(key);
    };
    // Generate stable key for array items
    var generateKey = function (item) {
        var id = keyCounter++;
        return (0, util_1.isString)(keyConfig)
            ? "".concat(keyConfig).concat(id)
            : (0, util_1.isFunction)(keyConfig)
                ? keyConfig(item)
                : String(id);
    };
    // Convert array to record with stable keys
    var arrayToRecord = function (array) {
        var record = {};
        for (var i = 0; i < array.length; i++) {
            var value = array[i];
            if (value === undefined)
                continue; // Skip sparse array positions
            var key = order[i];
            if (!key) {
                key = generateKey(value);
                order[i] = key;
            }
            record[key] = value;
        }
        return record;
    };
    // Get current record
    var current = function () {
        return order
            .map(function (key) { var _a; return (_a = signals.get(key)) === null || _a === void 0 ? void 0 : _a.get(); })
            .filter(function (v) { return v !== undefined; });
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
    // Add nested signal and own watcher
    var addProperty = function (key, value, single) {
        if (single === void 0) { single = false; }
        if (!isValidValue(key, value))
            return false;
        // Create signal for key
        // @ts-expect-error ignore
        var signal = (0, state_1.isState)(value) || (0, store_1.isStore)(value)
            ? value
            : (0, util_1.isRecord)(value) || Array.isArray(value)
                ? (0, store_1.createStore)(value)
                : (0, state_1.createState)(value);
        // Set internal states
        // @ts-expect-error ignore
        signals.set(key, signal);
        if (!order.includes(key))
            order.push(key);
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
        var index = order.indexOf(key);
        if (index >= 0)
            order.splice(index, 1);
        var watcher = ownWatchers.get(key);
        if (watcher) {
            watcher.stop();
            ownWatchers.delete(key);
        }
        if (single) {
            order = order.filter(function () { return true; }); // Compact array
            (0, system_1.notifyWatchers)(watchers);
        }
    };
    // Commit batched changes and emit notifications
    var batchChanges = function (changes) {
        // Additions
        if (Object.keys(changes.add).length) {
            for (var key in changes.add)
                // @ts-expect-error ignore
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
            order = order.filter(function () { return true; });
        }
        return changes.changed;
    };
    // Reconcile data and dispatch events
    var reconcile = function (oldValue, newValue) {
        return batchChanges((0, diff_1.diff)(arrayToRecord(oldValue), arrayToRecord(newValue)));
    };
    // Initialize data
    reconcile([], initialValue);
    // Methods and Properties
    var prototype = {};
    Object.defineProperties(prototype, (_a = {},
        _a[Symbol.toStringTag] = {
            value: TYPE_LIST,
        },
        _a[Symbol.isConcatSpreadable] = {
            value: true,
        },
        _a[Symbol.iterator] = {
            value: function () {
                var _i, order_1, key, signal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _i = 0, order_1 = order;
                            _a.label = 1;
                        case 1:
                            if (!(_i < order_1.length)) return [3 /*break*/, 4];
                            key = order_1[_i];
                            signal = signals.get(key);
                            if (!signal) return [3 /*break*/, 3];
                            return [4 /*yield*/, signal];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/];
                    }
                });
            },
        },
        _a.length = {
            get: function () {
                (0, system_1.subscribeActiveWatcher)(watchers);
                return signals.size;
            },
        },
        _a.order = {
            get: function () {
                (0, system_1.subscribeActiveWatcher)(watchers);
                return order;
            },
        },
        _a.at = {
            value: function (index) {
                return signals.get(order[index]);
            },
        },
        _a.byKey = {
            value: function (key) {
                return getSignal(key);
            },
        },
        _a.deriveCollection = {
            value: function (callback) {
                var collection = (0, collection_1.createCollection)(list, callback);
                return collection;
            },
        },
        _a.keyAt = {
            value: function (index) {
                return order[index];
            },
        },
        _a.indexOfKey = {
            value: function (key) {
                return order.indexOf(key);
            },
        },
        _a.get = {
            value: function () {
                (0, system_1.subscribeActiveWatcher)(watchers);
                return current();
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
                var oldValue = current();
                var newValue = fn(oldValue);
                if (reconcile(oldValue, newValue)) {
                    (0, system_1.notifyWatchers)(watchers);
                    if (system_1.UNSET === newValue)
                        watchers.clear();
                }
            },
        },
        _a.add = {
            value: function (value) {
                var key = generateKey(value);
                if (!signals.has(key)) {
                    // @ts-expect-error ignore
                    addProperty(key, value, true);
                    return key;
                }
                else
                    throw new errors_1.DuplicateKeyError('store', key, value);
            },
        },
        _a.remove = {
            value: function (keyOrIndex) {
                var key = (0, util_1.isNumber)(keyOrIndex)
                    ? order[keyOrIndex]
                    : keyOrIndex;
                if (key && signals.has(key))
                    removeProperty(key, true);
            },
        },
        _a.sort = {
            value: function (compareFn) {
                var entries = order
                    .map(function (key) { var _a; return [key, (_a = signals.get(key)) === null || _a === void 0 ? void 0 : _a.get()]; })
                    .sort(compareFn
                    ? function (a, b) { return compareFn(a[1], b[1]); }
                    : function (a, b) {
                        return String(a[1]).localeCompare(String(b[1]));
                    });
                // Set new order
                var newOrder = entries.map(function (_a) {
                    var key = _a[0];
                    return key;
                });
                if (!(0, diff_1.isEqual)(newOrder, order)) {
                    order = newOrder;
                    (0, system_1.notifyWatchers)(watchers);
                }
            },
        },
        _a.splice = {
            value: function (start, deleteCount) {
                var items = [];
                for (var _i = 2; _i < arguments.length; _i++) {
                    items[_i - 2] = arguments[_i];
                }
                // Normalize start and deleteCount
                var length = signals.size;
                var actualStart = start < 0
                    ? Math.max(0, length + start)
                    : Math.min(start, length);
                var actualDeleteCount = Math.max(0, Math.min(deleteCount !== null && deleteCount !== void 0 ? deleteCount : Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
                var add = {};
                var remove = {};
                // Collect items to delete and their keys
                for (var i = 0; i < actualDeleteCount; i++) {
                    var index = actualStart + i;
                    var key = order[index];
                    if (key) {
                        var signal = signals.get(key);
                        if (signal)
                            remove[key] = signal.get();
                    }
                }
                // Build new order: items before splice point
                var newOrder = order.slice(0, actualStart);
                // Add new items
                for (var _a = 0, items_1 = items; _a < items_1.length; _a++) {
                    var item = items_1[_a];
                    var key = generateKey(item);
                    newOrder.push(key);
                    add[key] = item;
                }
                // Add items after splice point
                newOrder.push.apply(newOrder, order.slice(actualStart + actualDeleteCount));
                // Update the order array
                order = newOrder.filter(function () { return true; }); // Compact array
                var changed = !!(Object.keys(add).length || Object.keys(remove).length);
                if (changed)
                    batchChanges({
                        add: add,
                        change: {},
                        remove: remove,
                        changed: changed,
                    });
                (0, system_1.notifyWatchers)(watchers);
                return Object.values(remove);
            },
        },
        _a));
    // Return proxy directly with integrated signal methods
    var list = new Proxy(prototype, {
        get: function (target, prop) {
            if (prop in target)
                return Reflect.get(target, prop);
            if (!(0, util_1.isSymbol)(prop))
                return getSignal(prop);
        },
        has: function (target, prop) {
            if (prop in target)
                return true;
            return signals.has(String(prop));
        },
        ownKeys: function (target) {
            var staticKeys = Reflect.ownKeys(target);
            return __spreadArray([], new Set(__spreadArray(__spreadArray([], order, true), staticKeys, true)), true);
        },
        getOwnPropertyDescriptor: function (target, prop) {
            if (prop in target)
                return Reflect.getOwnPropertyDescriptor(target, prop);
            if ((0, util_1.isSymbol)(prop))
                return undefined;
            var signal = getSignal(prop);
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
    return list;
};
exports.createList = createList;
/**
 * Check if the provided value is a List instance
 *
 * @since 0.15.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a List instance, false otherwise
 */
var isList = function (value) {
    return (0, util_1.isObjectOfType)(value, TYPE_LIST);
};
exports.isList = isList;
