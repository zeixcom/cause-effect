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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _DerivedCollection_instances, _DerivedCollection_source, _DerivedCollection_callback, _DerivedCollection_signals, _DerivedCollection_keys, _DerivedCollection_dirty, _DerivedCollection_watcher, _DerivedCollection_getWatcher, _DerivedCollection_add;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPE_COLLECTION = exports.isCollection = exports.DerivedCollection = void 0;
var errors_1 = require("../errors");
var system_1 = require("../system");
var util_1 = require("../util");
var computed_1 = require("./computed");
var list_1 = require("./list");
/* === Constants === */
var TYPE_COLLECTION = 'Collection';
exports.TYPE_COLLECTION = TYPE_COLLECTION;
/* === Class === */
var DerivedCollection = /** @class */ (function () {
    function DerivedCollection(source, callback, options) {
        _DerivedCollection_instances.add(this);
        _DerivedCollection_source.set(this, void 0);
        _DerivedCollection_callback.set(this, void 0);
        _DerivedCollection_signals.set(this, new Map());
        _DerivedCollection_keys.set(this, []);
        _DerivedCollection_dirty.set(this, true);
        _DerivedCollection_watcher.set(this, void 0);
        (0, errors_1.validateCallback)(TYPE_COLLECTION, callback);
        if ((0, util_1.isFunction)(source))
            source = source();
        if (!isCollectionSource(source))
            throw new errors_1.InvalidCollectionSourceError(TYPE_COLLECTION, source);
        __classPrivateFieldSet(this, _DerivedCollection_source, source, "f");
        __classPrivateFieldSet(this, _DerivedCollection_callback, callback, "f");
        for (var i = 0; i < __classPrivateFieldGet(this, _DerivedCollection_source, "f").length; i++) {
            var key = __classPrivateFieldGet(this, _DerivedCollection_source, "f").keyAt(i);
            if (!key)
                continue;
            __classPrivateFieldGet(this, _DerivedCollection_instances, "m", _DerivedCollection_add).call(this, key);
        }
        if (options === null || options === void 0 ? void 0 : options.watched)
            (0, system_1.registerWatchCallbacks)(this, options.watched, options.unwatched);
    }
    Object.defineProperty(DerivedCollection.prototype, (_DerivedCollection_source = new WeakMap(), _DerivedCollection_callback = new WeakMap(), _DerivedCollection_signals = new WeakMap(), _DerivedCollection_keys = new WeakMap(), _DerivedCollection_dirty = new WeakMap(), _DerivedCollection_watcher = new WeakMap(), _DerivedCollection_instances = new WeakSet(), _DerivedCollection_getWatcher = function _DerivedCollection_getWatcher() {
        var _this = this;
        __classPrivateFieldSet(this, _DerivedCollection_watcher, __classPrivateFieldGet(this, _DerivedCollection_watcher, "f") || (0, system_1.createWatcher)(function () {
            var _a;
            __classPrivateFieldSet(_this, _DerivedCollection_dirty, true, "f");
            if (!(0, system_1.notifyOf)(_this))
                (_a = __classPrivateFieldGet(_this, _DerivedCollection_watcher, "f")) === null || _a === void 0 ? void 0 : _a.stop();
        }, function () {
            var newKeys = Array.from(__classPrivateFieldGet(_this, _DerivedCollection_source, "f").keys());
            var allKeys = new Set(__spreadArray(__spreadArray([], __classPrivateFieldGet(_this, _DerivedCollection_keys, "f"), true), newKeys, true));
            var addedKeys = [];
            var removedKeys = [];
            for (var _i = 0, allKeys_1 = allKeys; _i < allKeys_1.length; _i++) {
                var key = allKeys_1[_i];
                var oldHas = __classPrivateFieldGet(_this, _DerivedCollection_keys, "f").includes(key);
                var newHas = newKeys.includes(key);
                if (!oldHas && newHas)
                    addedKeys.push(key);
                else if (oldHas && !newHas)
                    removedKeys.push(key);
            }
            for (var _a = 0, removedKeys_1 = removedKeys; _a < removedKeys_1.length; _a++) {
                var key = removedKeys_1[_a];
                __classPrivateFieldGet(_this, _DerivedCollection_signals, "f").delete(key);
            }
            for (var _b = 0, addedKeys_1 = addedKeys; _b < addedKeys_1.length; _b++) {
                var key = addedKeys_1[_b];
                __classPrivateFieldGet(_this, _DerivedCollection_instances, "m", _DerivedCollection_add).call(_this, key);
            }
            __classPrivateFieldSet(_this, _DerivedCollection_keys, newKeys, "f");
            __classPrivateFieldSet(_this, _DerivedCollection_dirty, false, "f");
        }), "f");
        __classPrivateFieldGet(this, _DerivedCollection_watcher, "f").onCleanup(function () {
            __classPrivateFieldSet(_this, _DerivedCollection_watcher, undefined, "f");
        });
        return __classPrivateFieldGet(this, _DerivedCollection_watcher, "f");
    }, _DerivedCollection_add = function _DerivedCollection_add(key) {
        var _this = this;
        var computedCallback = isAsyncCollectionCallback(__classPrivateFieldGet(this, _DerivedCollection_callback, "f"))
            ? function (_, abort) {
                var _a;
                var sourceValue = (_a = __classPrivateFieldGet(_this, _DerivedCollection_source, "f").byKey(key)) === null || _a === void 0 ? void 0 : _a.get();
                if (sourceValue === system_1.UNSET)
                    return system_1.UNSET;
                return __classPrivateFieldGet(_this, _DerivedCollection_callback, "f").call(_this, sourceValue, abort);
            }
            : function () {
                var _a;
                var sourceValue = (_a = __classPrivateFieldGet(_this, _DerivedCollection_source, "f").byKey(key)) === null || _a === void 0 ? void 0 : _a.get();
                if (sourceValue === system_1.UNSET)
                    return system_1.UNSET;
                return __classPrivateFieldGet(_this, _DerivedCollection_callback, "f")(sourceValue);
            };
        var signal = (0, computed_1.createComputed)(computedCallback);
        __classPrivateFieldGet(this, _DerivedCollection_signals, "f").set(key, signal);
        if (!__classPrivateFieldGet(this, _DerivedCollection_keys, "f").includes(key))
            __classPrivateFieldGet(this, _DerivedCollection_keys, "f").push(key);
        return true;
    }, Symbol.toStringTag), {
        get: function () {
            return TYPE_COLLECTION;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DerivedCollection.prototype, Symbol.isConcatSpreadable, {
        get: function () {
            return true;
        },
        enumerable: false,
        configurable: true
    });
    DerivedCollection.prototype[Symbol.iterator] = function () {
        var _i, _a, key, signal;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _i = 0, _a = __classPrivateFieldGet(this, _DerivedCollection_keys, "f");
                    _b.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    key = _a[_i];
                    signal = __classPrivateFieldGet(this, _DerivedCollection_signals, "f").get(key);
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
    DerivedCollection.prototype.keys = function () {
        (0, system_1.subscribeTo)(this);
        if (__classPrivateFieldGet(this, _DerivedCollection_dirty, "f"))
            __classPrivateFieldGet(this, _DerivedCollection_instances, "m", _DerivedCollection_getWatcher).call(this).run();
        return __classPrivateFieldGet(this, _DerivedCollection_keys, "f").values();
    };
    DerivedCollection.prototype.get = function () {
        var _this = this;
        (0, system_1.subscribeTo)(this);
        if (__classPrivateFieldGet(this, _DerivedCollection_dirty, "f"))
            __classPrivateFieldGet(this, _DerivedCollection_instances, "m", _DerivedCollection_getWatcher).call(this).run();
        return __classPrivateFieldGet(this, _DerivedCollection_keys, "f")
            .map(function (key) { var _a; return (_a = __classPrivateFieldGet(_this, _DerivedCollection_signals, "f").get(key)) === null || _a === void 0 ? void 0 : _a.get(); })
            .filter(function (v) { return v != null && v !== system_1.UNSET; });
    };
    DerivedCollection.prototype.at = function (index) {
        return __classPrivateFieldGet(this, _DerivedCollection_signals, "f").get(__classPrivateFieldGet(this, _DerivedCollection_keys, "f")[index]);
    };
    DerivedCollection.prototype.byKey = function (key) {
        return __classPrivateFieldGet(this, _DerivedCollection_signals, "f").get(key);
    };
    DerivedCollection.prototype.keyAt = function (index) {
        return __classPrivateFieldGet(this, _DerivedCollection_keys, "f")[index];
    };
    DerivedCollection.prototype.indexOfKey = function (key) {
        return __classPrivateFieldGet(this, _DerivedCollection_keys, "f").indexOf(key);
    };
    DerivedCollection.prototype.deriveCollection = function (callback, options) {
        return new DerivedCollection(this, callback, options);
    };
    Object.defineProperty(DerivedCollection.prototype, "length", {
        get: function () {
            (0, system_1.subscribeTo)(this);
            if (__classPrivateFieldGet(this, _DerivedCollection_dirty, "f"))
                __classPrivateFieldGet(this, _DerivedCollection_instances, "m", _DerivedCollection_getWatcher).call(this).run();
            return __classPrivateFieldGet(this, _DerivedCollection_keys, "f").length;
        },
        enumerable: false,
        configurable: true
    });
    return DerivedCollection;
}());
exports.DerivedCollection = DerivedCollection;
/* === Functions === */
/**
 * Check if a value is a collection signal
 *
 * @since 0.17.2
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
var isCollection = /*#__PURE__*/ function (value) { return (0, util_1.isObjectOfType)(value, TYPE_COLLECTION); };
exports.isCollection = isCollection;
/**
 * Check if a value is a collection source
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection source, false otherwise
 */
var isCollectionSource = /*#__PURE__*/ function (value) { return (0, list_1.isList)(value) || isCollection(value); };
/**
 * Check if the provided callback is an async function
 *
 * @since 0.17.0
 * @param {unknown} callback - Value to check
 * @returns {boolean} - True if value is an async collection callback, false otherwise
 */
var isAsyncCollectionCallback = function (callback) {
    return (0, util_1.isAsyncFunction)(callback);
};
