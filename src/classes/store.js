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
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _BaseStore_instances, _BaseStore_signals, _BaseStore_value_get, _BaseStore_validate, _BaseStore_add, _BaseStore_change;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPE_STORE = exports.BaseStore = exports.isStore = exports.createStore = void 0;
var diff_1 = require("../diff");
var errors_1 = require("../errors");
var signal_1 = require("../signal");
var system_1 = require("../system");
var util_1 = require("../util");
/* === Constants === */
var TYPE_STORE = 'Store';
exports.TYPE_STORE = TYPE_STORE;
/* === Store Implementation === */
/**
 * Create a new store with the given initial value.
 *
 * @since 0.17.0
 * @param {T} initialValue - The initial value of the store
 * @throws {NullishSignalValueError} - If the initial value is null or undefined
 * @throws {InvalidSignalValueError} - If the initial value is not an object
 */
var BaseStore = /** @class */ (function () {
    function BaseStore(initialValue, options) {
        var _a;
        _BaseStore_instances.add(this);
        _BaseStore_signals.set(this, new Map());
        (0, errors_1.validateSignalValue)(TYPE_STORE, initialValue, (_a = options === null || options === void 0 ? void 0 : options.guard) !== null && _a !== void 0 ? _a : util_1.isRecord);
        __classPrivateFieldGet(this, _BaseStore_instances, "m", _BaseStore_change).call(this, {
            add: initialValue,
            change: {},
            remove: {},
            changed: true,
        });
        if (options === null || options === void 0 ? void 0 : options.watched)
            (0, system_1.registerWatchCallbacks)(this, options.watched, options.unwatched);
    }
    Object.defineProperty(BaseStore.prototype, (_BaseStore_signals = new WeakMap(), _BaseStore_instances = new WeakSet(), _BaseStore_value_get = function _BaseStore_value_get() {
        var record = {};
        for (var _i = 0, _a = __classPrivateFieldGet(this, _BaseStore_signals, "f").entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], signal = _b[1];
            record[key] = signal.get();
        }
        return record;
    }, _BaseStore_validate = function _BaseStore_validate(key, value) {
        (0, errors_1.validateSignalValue)("".concat(TYPE_STORE, " for key \"").concat(key, "\""), value);
        return true;
    }, _BaseStore_add = function _BaseStore_add(key, value) {
        if (!__classPrivateFieldGet(this, _BaseStore_instances, "m", _BaseStore_validate).call(this, key, value))
            return false;
        __classPrivateFieldGet(this, _BaseStore_signals, "f").set(key, (0, signal_1.createMutableSignal)(value));
        return true;
    }, _BaseStore_change = function _BaseStore_change(changes) {
        var _this = this;
        // Additions
        if (Object.keys(changes.add).length) {
            for (var key in changes.add)
                __classPrivateFieldGet(this, _BaseStore_instances, "m", _BaseStore_add).call(this, key, changes.add[key]);
        }
        // Changes
        if (Object.keys(changes.change).length) {
            (0, system_1.batch)(function () {
                for (var key in changes.change) {
                    var value = changes.change[key];
                    if (!__classPrivateFieldGet(_this, _BaseStore_instances, "m", _BaseStore_validate).call(_this, key, value))
                        continue;
                    var signal = __classPrivateFieldGet(_this, _BaseStore_signals, "f").get(key);
                    if ((0, errors_1.guardMutableSignal)("list item \"".concat(key, "\""), value, signal))
                        signal.set(value);
                }
            });
        }
        // Removals
        if (Object.keys(changes.remove).length) {
            for (var key in changes.remove)
                this.remove(key);
        }
        return changes.changed;
    }, Symbol.toStringTag), {
        // Public methods
        get: function () {
            return TYPE_STORE;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(BaseStore.prototype, Symbol.isConcatSpreadable, {
        get: function () {
            return false;
        },
        enumerable: false,
        configurable: true
    });
    BaseStore.prototype[Symbol.iterator] = function () {
        var _i, _a, _b, key, signal;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _i = 0, _a = __classPrivateFieldGet(this, _BaseStore_signals, "f").entries();
                    _c.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    _b = _a[_i], key = _b[0], signal = _b[1];
                    return [4 /*yield*/, [key, signal]];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    };
    BaseStore.prototype.keys = function () {
        (0, system_1.subscribeTo)(this);
        return __classPrivateFieldGet(this, _BaseStore_signals, "f").keys();
    };
    BaseStore.prototype.byKey = function (key) {
        return __classPrivateFieldGet(this, _BaseStore_signals, "f").get(key);
    };
    BaseStore.prototype.get = function () {
        (0, system_1.subscribeTo)(this);
        return __classPrivateFieldGet(this, _BaseStore_instances, "a", _BaseStore_value_get);
    };
    BaseStore.prototype.set = function (newValue) {
        if (system_1.UNSET === newValue) {
            __classPrivateFieldGet(this, _BaseStore_signals, "f").clear();
            (0, system_1.notifyOf)(this);
            (0, system_1.unsubscribeAllFrom)(this);
            return;
        }
        var changed = __classPrivateFieldGet(this, _BaseStore_instances, "m", _BaseStore_change).call(this, (0, diff_1.diff)(__classPrivateFieldGet(this, _BaseStore_instances, "a", _BaseStore_value_get), newValue));
        if (changed)
            (0, system_1.notifyOf)(this);
    };
    BaseStore.prototype.update = function (fn) {
        this.set(fn(this.get()));
    };
    BaseStore.prototype.add = function (key, value) {
        if (__classPrivateFieldGet(this, _BaseStore_signals, "f").has(key))
            throw new errors_1.DuplicateKeyError(TYPE_STORE, key, value);
        var ok = __classPrivateFieldGet(this, _BaseStore_instances, "m", _BaseStore_add).call(this, key, value);
        if (ok)
            (0, system_1.notifyOf)(this);
        return key;
    };
    BaseStore.prototype.remove = function (key) {
        var ok = __classPrivateFieldGet(this, _BaseStore_signals, "f").delete(key);
        if (ok)
            (0, system_1.notifyOf)(this);
    };
    return BaseStore;
}());
exports.BaseStore = BaseStore;
/* === Functions === */
/**
 * Create a new store with deeply nested reactive properties
 *
 * @since 0.15.0
 * @param {T} initialValue - Initial object or array value of the store
 * @param {SignalOptions<T>} options - Options for the store
 * @returns {Store<T>} - New store with reactive properties that preserves the original type T
 */
var createStore = function (initialValue, options) {
    var instance = new BaseStore(initialValue, options);
    // Return proxy for property access
    return new Proxy(instance, {
        get: function (target, prop) {
            if (prop in target) {
                var value = Reflect.get(target, prop);
                return (0, util_1.isFunction)(value) ? value.bind(target) : value;
            }
            if (!(0, util_1.isSymbol)(prop))
                return target.byKey(prop);
        },
        has: function (target, prop) {
            if (prop in target)
                return true;
            return target.byKey(String(prop)) !== undefined;
        },
        ownKeys: function (target) {
            return Array.from(target.keys());
        },
        getOwnPropertyDescriptor: function (target, prop) {
            if (prop in target)
                return Reflect.getOwnPropertyDescriptor(target, prop);
            if ((0, util_1.isSymbol)(prop))
                return undefined;
            var signal = target.byKey(String(prop));
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
exports.createStore = createStore;
/**
 * Check if the provided value is a Store instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Store instance, false otherwise
 */
var isStore = function (value) { return (0, util_1.isObjectOfType)(value, TYPE_STORE); };
exports.isStore = isStore;
