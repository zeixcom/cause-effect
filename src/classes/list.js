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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _List_instances, _List_signals, _List_keys, _List_generateKey, _List_validate, _List_toRecord, _List_add, _List_change, _List_value_get;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPE_LIST = exports.List = exports.isList = void 0;
var diff_1 = require("../diff");
var errors_1 = require("../errors");
var system_1 = require("../system");
var util_1 = require("../util");
var collection_1 = require("./collection");
var state_1 = require("./state");
/* === Constants === */
var TYPE_LIST = 'List';
exports.TYPE_LIST = TYPE_LIST;
/* === Class === */
var List = /** @class */ (function () {
    function List(initialValue, options) {
        _List_instances.add(this);
        _List_signals.set(this, new Map());
        _List_keys.set(this, []);
        _List_generateKey.set(this, void 0);
        _List_validate.set(this, void 0);
        (0, errors_1.validateSignalValue)(TYPE_LIST, initialValue, Array.isArray);
        var keyCounter = 0;
        var keyConfig = options === null || options === void 0 ? void 0 : options.keyConfig;
        __classPrivateFieldSet(this, _List_generateKey, (0, util_1.isString)(keyConfig)
            ? function () { return "".concat(keyConfig).concat(keyCounter++); }
            : (0, util_1.isFunction)(keyConfig)
                ? function (item) { return keyConfig(item); }
                : function () { return String(keyCounter++); }, "f");
        __classPrivateFieldSet(this, _List_validate, function (key, value) {
            (0, errors_1.validateSignalValue)("".concat(TYPE_LIST, " item for key \"").concat(key, "\""), value, options === null || options === void 0 ? void 0 : options.guard);
            return true;
        }, "f");
        __classPrivateFieldGet(this, _List_instances, "m", _List_change).call(this, {
            add: __classPrivateFieldGet(this, _List_instances, "m", _List_toRecord).call(this, initialValue),
            change: {},
            remove: {},
            changed: true,
        });
        if (options === null || options === void 0 ? void 0 : options.watched)
            (0, system_1.registerWatchCallbacks)(this, options.watched, options.unwatched);
    }
    Object.defineProperty(List.prototype, (_List_signals = new WeakMap(), _List_keys = new WeakMap(), _List_generateKey = new WeakMap(), _List_validate = new WeakMap(), _List_instances = new WeakSet(), _List_toRecord = function _List_toRecord(array) {
        var record = {};
        for (var i = 0; i < array.length; i++) {
            var value = array[i];
            if (value === undefined)
                continue; // Skip sparse array positions
            var key = __classPrivateFieldGet(this, _List_keys, "f")[i];
            if (!key) {
                key = __classPrivateFieldGet(this, _List_generateKey, "f").call(this, value);
                __classPrivateFieldGet(this, _List_keys, "f")[i] = key;
            }
            record[key] = value;
        }
        return record;
    }, _List_add = function _List_add(key, value) {
        if (!__classPrivateFieldGet(this, _List_validate, "f").call(this, key, value))
            return false;
        __classPrivateFieldGet(this, _List_signals, "f").set(key, new state_1.State(value));
        return true;
    }, _List_change = function _List_change(changes) {
        var _this = this;
        // Additions
        if (Object.keys(changes.add).length) {
            for (var key in changes.add)
                __classPrivateFieldGet(this, _List_instances, "m", _List_add).call(this, key, changes.add[key]);
        }
        // Changes
        if (Object.keys(changes.change).length) {
            (0, system_1.batch)(function () {
                for (var key in changes.change) {
                    var value = changes.change[key];
                    if (!__classPrivateFieldGet(_this, _List_validate, "f").call(_this, key, value))
                        continue;
                    var signal = __classPrivateFieldGet(_this, _List_signals, "f").get(key);
                    if ((0, errors_1.guardMutableSignal)("".concat(TYPE_LIST, " item \"").concat(key, "\""), value, signal))
                        signal.set(value);
                }
            });
        }
        // Removals
        if (Object.keys(changes.remove).length) {
            for (var key in changes.remove) {
                __classPrivateFieldGet(this, _List_signals, "f").delete(key);
                var index = __classPrivateFieldGet(this, _List_keys, "f").indexOf(key);
                if (index !== -1)
                    __classPrivateFieldGet(this, _List_keys, "f").splice(index, 1);
            }
            __classPrivateFieldSet(this, _List_keys, __classPrivateFieldGet(this, _List_keys, "f").filter(function () { return true; }), "f");
        }
        return changes.changed;
    }, _List_value_get = function _List_value_get() {
        var _this = this;
        return __classPrivateFieldGet(this, _List_keys, "f")
            .map(function (key) { var _a; return (_a = __classPrivateFieldGet(_this, _List_signals, "f").get(key)) === null || _a === void 0 ? void 0 : _a.get(); })
            .filter(function (v) { return v !== undefined; });
    }, Symbol.toStringTag), {
        // Public methods
        get: function () {
            return TYPE_LIST;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(List.prototype, Symbol.isConcatSpreadable, {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    List.prototype[Symbol.iterator] = function () {
        var _i, _a, key, signal;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _i = 0, _a = __classPrivateFieldGet(this, _List_keys, "f");
                    _b.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    key = _a[_i];
                    signal = __classPrivateFieldGet(this, _List_signals, "f").get(key);
                    if (!signal) return [3 /*break*/, 3];
                    return [4 /*yield*/, signal];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    };
    Object.defineProperty(List.prototype, "length", {
        get: function () {
            (0, system_1.subscribeTo)(this);
            return __classPrivateFieldGet(this, _List_keys, "f").length;
        },
        enumerable: false,
        configurable: true
    });
    List.prototype.get = function () {
        (0, system_1.subscribeTo)(this);
        return __classPrivateFieldGet(this, _List_instances, "a", _List_value_get);
    };
    List.prototype.set = function (newValue) {
        if (system_1.UNSET === newValue) {
            __classPrivateFieldGet(this, _List_signals, "f").clear();
            (0, system_1.notifyOf)(this);
            (0, system_1.unsubscribeAllFrom)(this);
            return;
        }
        var changes = (0, diff_1.diff)(__classPrivateFieldGet(this, _List_instances, "m", _List_toRecord).call(this, __classPrivateFieldGet(this, _List_instances, "a", _List_value_get)), __classPrivateFieldGet(this, _List_instances, "m", _List_toRecord).call(this, newValue));
        if (__classPrivateFieldGet(this, _List_instances, "m", _List_change).call(this, changes))
            (0, system_1.notifyOf)(this);
    };
    List.prototype.update = function (fn) {
        this.set(fn(this.get()));
    };
    List.prototype.at = function (index) {
        return __classPrivateFieldGet(this, _List_signals, "f").get(__classPrivateFieldGet(this, _List_keys, "f")[index]);
    };
    List.prototype.keys = function () {
        (0, system_1.subscribeTo)(this);
        return __classPrivateFieldGet(this, _List_keys, "f").values();
    };
    List.prototype.byKey = function (key) {
        return __classPrivateFieldGet(this, _List_signals, "f").get(key);
    };
    List.prototype.keyAt = function (index) {
        return __classPrivateFieldGet(this, _List_keys, "f")[index];
    };
    List.prototype.indexOfKey = function (key) {
        return __classPrivateFieldGet(this, _List_keys, "f").indexOf(key);
    };
    List.prototype.add = function (value) {
        var key = __classPrivateFieldGet(this, _List_generateKey, "f").call(this, value);
        if (__classPrivateFieldGet(this, _List_signals, "f").has(key))
            throw new errors_1.DuplicateKeyError('store', key, value);
        if (!__classPrivateFieldGet(this, _List_keys, "f").includes(key))
            __classPrivateFieldGet(this, _List_keys, "f").push(key);
        var ok = __classPrivateFieldGet(this, _List_instances, "m", _List_add).call(this, key, value);
        if (ok)
            (0, system_1.notifyOf)(this);
        return key;
    };
    List.prototype.remove = function (keyOrIndex) {
        var key = (0, util_1.isNumber)(keyOrIndex) ? __classPrivateFieldGet(this, _List_keys, "f")[keyOrIndex] : keyOrIndex;
        var ok = __classPrivateFieldGet(this, _List_signals, "f").delete(key);
        if (ok) {
            var index = (0, util_1.isNumber)(keyOrIndex)
                ? keyOrIndex
                : __classPrivateFieldGet(this, _List_keys, "f").indexOf(key);
            if (index >= 0)
                __classPrivateFieldGet(this, _List_keys, "f").splice(index, 1);
            __classPrivateFieldSet(this, _List_keys, __classPrivateFieldGet(this, _List_keys, "f").filter(function () { return true; }), "f");
            (0, system_1.notifyOf)(this);
        }
    };
    List.prototype.sort = function (compareFn) {
        var _this = this;
        var entries = __classPrivateFieldGet(this, _List_keys, "f")
            .map(function (key) { var _a; return [key, (_a = __classPrivateFieldGet(_this, _List_signals, "f").get(key)) === null || _a === void 0 ? void 0 : _a.get()]; })
            .sort((0, util_1.isFunction)(compareFn)
            ? function (a, b) { return compareFn(a[1], b[1]); }
            : function (a, b) { return String(a[1]).localeCompare(String(b[1])); });
        var newOrder = entries.map(function (_a) {
            var key = _a[0];
            return key;
        });
        if (!(0, diff_1.isEqual)(__classPrivateFieldGet(this, _List_keys, "f"), newOrder)) {
            __classPrivateFieldSet(this, _List_keys, newOrder, "f");
            (0, system_1.notifyOf)(this);
        }
    };
    List.prototype.splice = function (start, deleteCount) {
        var items = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            items[_i - 2] = arguments[_i];
        }
        var length = __classPrivateFieldGet(this, _List_keys, "f").length;
        var actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
        var actualDeleteCount = Math.max(0, Math.min(deleteCount !== null && deleteCount !== void 0 ? deleteCount : Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
        var add = {};
        var remove = {};
        // Collect items to delete and their keys
        for (var i = 0; i < actualDeleteCount; i++) {
            var index = actualStart + i;
            var key = __classPrivateFieldGet(this, _List_keys, "f")[index];
            if (key) {
                var signal = __classPrivateFieldGet(this, _List_signals, "f").get(key);
                if (signal)
                    remove[key] = signal.get();
            }
        }
        // Build new order: items before splice point
        var newOrder = __classPrivateFieldGet(this, _List_keys, "f").slice(0, actualStart);
        // Add new items
        for (var _a = 0, items_1 = items; _a < items_1.length; _a++) {
            var item = items_1[_a];
            var key = __classPrivateFieldGet(this, _List_generateKey, "f").call(this, item);
            newOrder.push(key);
            add[key] = item;
        }
        // Add items after splice point
        newOrder.push.apply(newOrder, __classPrivateFieldGet(this, _List_keys, "f").slice(actualStart + actualDeleteCount));
        var changed = !!(Object.keys(add).length || Object.keys(remove).length);
        if (changed) {
            __classPrivateFieldGet(this, _List_instances, "m", _List_change).call(this, {
                add: add,
                change: {},
                remove: remove,
                changed: changed,
            });
            __classPrivateFieldSet(this, _List_keys, newOrder.filter(function () { return true; }), "f"); // Update order array
            (0, system_1.notifyOf)(this);
        }
        return Object.values(remove);
    };
    List.prototype.deriveCollection = function (callback, options) {
        return new collection_1.DerivedCollection(this, callback, options);
    };
    return List;
}());
exports.List = List;
/* === Functions === */
/**
 * Check if the provided value is a List instance
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a List instance, false otherwise
 */
var isList = function (value) {
    return (0, util_1.isObjectOfType)(value, TYPE_LIST);
};
exports.isList = isList;
