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
exports.TYPE_COLLECTION = exports.isCollection = exports.createCollection = void 0;
var match_1 = require("../src/match");
var resolve_1 = require("../src/resolve");
var system_1 = require("../src/system");
var util_1 = require("../src/util");
var computed_1 = require("./computed");
/* === Constants === */
var TYPE_COLLECTION = 'Collection';
exports.TYPE_COLLECTION = TYPE_COLLECTION;
/* === Exported Functions === */
/**
 * Collections - Read-Only Derived Array-Like Stores
 *
 * Collections are the read-only, derived counterpart to array-like Stores.
 * They provide reactive, memoized, and lazily-evaluated array transformations
 * while maintaining the familiar array-like store interface.
 *
 * @since 0.16.2
 * @param {List<O> | Collection<O>} origin - Origin of collection to derive values from
 * @param {ComputedCallback<ArrayItem<T>>} callback - Callback function to transform array items
 * @returns {Collection<T>} - New collection with reactive properties that preserves the original type T
 */
var createCollection = function (origin, callback) {
    var _a;
    var watchers = new Set();
    var signals = new Map();
    var signalWatchers = new Map();
    var order = [];
    // Add nested signal and effect
    var addProperty = function (key) {
        var computedCallback = (0, util_1.isAsyncFunction)(callback)
            ? function (_, abort) { return __awaiter(void 0, void 0, void 0, function () {
                var originSignal, result;
                return __generator(this, function (_a) {
                    originSignal = origin.byKey(key);
                    if (!originSignal)
                        return [2 /*return*/, system_1.UNSET];
                    result = system_1.UNSET;
                    (0, match_1.match)((0, resolve_1.resolve)({ originSignal: originSignal }), {
                        ok: function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                            var originValue = _b.originSignal;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0: return [4 /*yield*/, callback(originValue, abort)];
                                    case 1:
                                        result = _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); },
                        err: function (errors) {
                            console.log(errors);
                        },
                    });
                    return [2 /*return*/, result];
                });
            }); }
            : function () {
                var originSignal = origin.byKey(key);
                if (!originSignal)
                    return system_1.UNSET;
                var result = system_1.UNSET;
                (0, match_1.match)((0, resolve_1.resolve)({ originSignal: originSignal }), {
                    ok: function (_a) {
                        var originValue = _a.originSignal;
                        result = callback(originValue);
                    },
                    err: function (errors) {
                        console.log(errors);
                    },
                });
                return result;
            };
        var signal = (0, computed_1.createComputed)(computedCallback);
        // Set internal states
        signals.set(key, signal);
        if (!order.includes(key))
            order.push(key);
        var watcher = (0, system_1.createWatcher)(function () {
            signal.get(); // Subscribe to the signal
        }, function () { });
        watcher();
        signalWatchers.set(key, watcher);
        return true;
    };
    // Initialize properties
    for (var i = 0; i < origin.length; i++) {
        var key = origin.keyAt(i);
        if (!key)
            continue;
        addProperty(key);
    }
    // Get signal by key or index
    var getSignal = function (prop) {
        var _a;
        var key = prop;
        var index = Number(prop);
        if (Number.isInteger(index) && index >= 0)
            key = (_a = order[index]) !== null && _a !== void 0 ? _a : prop;
        return signals.get(key);
    };
    // Get current array
    var current = function () {
        return order
            .map(function (key) { var _a; return (_a = signals.get(key)) === null || _a === void 0 ? void 0 : _a.get(); })
            .filter(function (v) { return v !== system_1.UNSET; });
    };
    // Methods and Properties
    var collection = {};
    Object.defineProperties(collection, (_a = {},
        _a[Symbol.toStringTag] = {
            value: TYPE_COLLECTION,
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
        _a.byKey = {
            value: function (key) {
                return getSignal(key);
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
        _a.sort = {
            value: function (compareFn) {
                var entries = order
                    .map(function (key, index) {
                    var signal = signals.get(key);
                    return [
                        index,
                        key,
                        signal ? signal.get() : undefined,
                    ];
                })
                    .sort(compareFn
                    ? function (a, b) { return compareFn(a[2], b[2]); }
                    : function (a, b) {
                        return String(a[2]).localeCompare(String(b[2]));
                    });
                // Set new order
                order = entries.map(function (_a) {
                    var _ = _a[0], key = _a[1];
                    return key;
                });
                (0, system_1.notifyWatchers)(watchers);
            },
        },
        _a.length = {
            get: function () {
                (0, system_1.subscribeActiveWatcher)(watchers);
                return signals.size;
            },
        },
        _a));
    // Return proxy directly with integrated signal methods
    return new Proxy(collection, {
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
};
exports.createCollection = createCollection;
var isCollection = /*#__PURE__*/ function (value) { return (0, util_1.isObjectOfType)(value, TYPE_COLLECTION); };
exports.isCollection = isCollection;
