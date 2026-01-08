"use strict";
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
var _Memo_instances, _Memo_callback, _Memo_value, _Memo_error, _Memo_dirty, _Memo_computing, _Memo_watcher, _Memo_getWatcher, _Task_instances, _Task_callback, _Task_value, _Task_error, _Task_dirty, _Task_computing, _Task_changed, _Task_watcher, _Task_controller, _Task_getWatcher;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = exports.Memo = exports.isTaskCallback = exports.isMemoCallback = exports.isComputed = exports.createComputed = exports.TYPE_COMPUTED = void 0;
var diff_1 = require("../diff");
var errors_1 = require("../errors");
var system_1 = require("../system");
var util_1 = require("../util");
/* === Constants === */
var TYPE_COMPUTED = 'Computed';
exports.TYPE_COMPUTED = TYPE_COMPUTED;
/* === Classes === */
/**
 * Create a new memoized signal for a synchronous function.
 *
 * @since 0.17.0
 * @param {MemoCallback<T>} callback - Callback function to compute the memoized value
 * @param {T} [initialValue = UNSET] - Initial value of the signal
 * @throws {InvalidCallbackError} If the callback is not an sync function
 * @throws {InvalidSignalValueError} If the initial value is not valid
 */
var Memo = /** @class */ (function () {
    function Memo(callback, options) {
        var _a;
        _Memo_instances.add(this);
        _Memo_callback.set(this, void 0);
        _Memo_value.set(this, void 0);
        _Memo_error.set(this, void 0);
        _Memo_dirty.set(this, true);
        _Memo_computing.set(this, false);
        _Memo_watcher.set(this, void 0);
        (0, errors_1.validateCallback)(this.constructor.name, callback, isMemoCallback);
        var initialValue = (_a = options === null || options === void 0 ? void 0 : options.initialValue) !== null && _a !== void 0 ? _a : system_1.UNSET;
        (0, errors_1.validateSignalValue)(this.constructor.name, initialValue, options === null || options === void 0 ? void 0 : options.guard);
        __classPrivateFieldSet(this, _Memo_callback, callback, "f");
        __classPrivateFieldSet(this, _Memo_value, initialValue, "f");
        if (options === null || options === void 0 ? void 0 : options.watched)
            (0, system_1.registerWatchCallbacks)(this, options.watched, options.unwatched);
    }
    Object.defineProperty(Memo.prototype, (_Memo_callback = new WeakMap(), _Memo_value = new WeakMap(), _Memo_error = new WeakMap(), _Memo_dirty = new WeakMap(), _Memo_computing = new WeakMap(), _Memo_watcher = new WeakMap(), _Memo_instances = new WeakSet(), _Memo_getWatcher = function _Memo_getWatcher() {
        var _this = this;
        // Own watcher: called by notifyWatchers() in upstream signals (push)
        __classPrivateFieldSet(this, _Memo_watcher, __classPrivateFieldGet(this, _Memo_watcher, "f") || (0, system_1.createWatcher)(function () {
            var _a;
            __classPrivateFieldSet(_this, _Memo_dirty, true, "f");
            if (!(0, system_1.notifyOf)(_this))
                (_a = __classPrivateFieldGet(_this, _Memo_watcher, "f")) === null || _a === void 0 ? void 0 : _a.stop();
        }, function () {
            if (__classPrivateFieldGet(_this, _Memo_computing, "f"))
                throw new errors_1.CircularDependencyError('memo');
            var result;
            __classPrivateFieldSet(_this, _Memo_computing, true, "f");
            try {
                result = __classPrivateFieldGet(_this, _Memo_callback, "f").call(_this, __classPrivateFieldGet(_this, _Memo_value, "f"));
            }
            catch (e) {
                // Err track
                __classPrivateFieldSet(_this, _Memo_value, system_1.UNSET, "f");
                __classPrivateFieldSet(_this, _Memo_error, (0, errors_1.createError)(e), "f");
                __classPrivateFieldSet(_this, _Memo_computing, false, "f");
                return;
            }
            if (null == result || system_1.UNSET === result) {
                // Nil track
                __classPrivateFieldSet(_this, _Memo_value, system_1.UNSET, "f");
                __classPrivateFieldSet(_this, _Memo_error, undefined, "f");
            }
            else {
                // Ok track
                __classPrivateFieldSet(_this, _Memo_value, result, "f");
                __classPrivateFieldSet(_this, _Memo_error, undefined, "f");
                __classPrivateFieldSet(_this, _Memo_dirty, false, "f");
            }
            __classPrivateFieldSet(_this, _Memo_computing, false, "f");
        }), "f");
        __classPrivateFieldGet(this, _Memo_watcher, "f").onCleanup(function () {
            __classPrivateFieldSet(_this, _Memo_watcher, undefined, "f");
        });
        return __classPrivateFieldGet(this, _Memo_watcher, "f");
    }, Symbol.toStringTag), {
        get: function () {
            return TYPE_COMPUTED;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Return the memoized value after computing it if necessary.
     *
     * @returns {T}
     * @throws {CircularDependencyError} If a circular dependency is detected
     * @throws {Error} If an error occurs during computation
     */
    Memo.prototype.get = function () {
        (0, system_1.subscribeTo)(this);
        (0, system_1.flush)();
        if (__classPrivateFieldGet(this, _Memo_dirty, "f"))
            __classPrivateFieldGet(this, _Memo_instances, "m", _Memo_getWatcher).call(this).run();
        if (__classPrivateFieldGet(this, _Memo_error, "f"))
            throw __classPrivateFieldGet(this, _Memo_error, "f");
        return __classPrivateFieldGet(this, _Memo_value, "f");
    };
    return Memo;
}());
exports.Memo = Memo;
/**
 * Create a new task signals that memoizes the result of an asynchronous function.
 *
 * @since 0.17.0
 * @param {TaskCallback<T>} callback - The asynchronous function to compute the memoized value
 * @param {T} [initialValue = UNSET] - Initial value of the signal
 * @throws {InvalidCallbackError} If the callback is not an async function
 * @throws {InvalidSignalValueError} If the initial value is not valid
 */
var Task = /** @class */ (function () {
    function Task(callback, options) {
        var _a;
        _Task_instances.add(this);
        _Task_callback.set(this, void 0);
        _Task_value.set(this, void 0);
        _Task_error.set(this, void 0);
        _Task_dirty.set(this, true);
        _Task_computing.set(this, false);
        _Task_changed.set(this, false);
        _Task_watcher.set(this, void 0);
        _Task_controller.set(this, void 0);
        (0, errors_1.validateCallback)(this.constructor.name, callback, isTaskCallback);
        var initialValue = (_a = options === null || options === void 0 ? void 0 : options.initialValue) !== null && _a !== void 0 ? _a : system_1.UNSET;
        (0, errors_1.validateSignalValue)(this.constructor.name, initialValue, options === null || options === void 0 ? void 0 : options.guard);
        __classPrivateFieldSet(this, _Task_callback, callback, "f");
        __classPrivateFieldSet(this, _Task_value, initialValue, "f");
        if (options === null || options === void 0 ? void 0 : options.watched)
            (0, system_1.registerWatchCallbacks)(this, options.watched, options.unwatched);
    }
    Object.defineProperty(Task.prototype, (_Task_callback = new WeakMap(), _Task_value = new WeakMap(), _Task_error = new WeakMap(), _Task_dirty = new WeakMap(), _Task_computing = new WeakMap(), _Task_changed = new WeakMap(), _Task_watcher = new WeakMap(), _Task_controller = new WeakMap(), _Task_instances = new WeakSet(), _Task_getWatcher = function _Task_getWatcher() {
        var _this = this;
        if (!__classPrivateFieldGet(this, _Task_watcher, "f")) {
            // Functions to update internal state
            var ok_1 = function (v) {
                if (!(0, diff_1.isEqual)(v, __classPrivateFieldGet(_this, _Task_value, "f"))) {
                    __classPrivateFieldSet(_this, _Task_value, v, "f");
                    __classPrivateFieldSet(_this, _Task_changed, true, "f");
                }
                __classPrivateFieldSet(_this, _Task_error, undefined, "f");
                __classPrivateFieldSet(_this, _Task_dirty, false, "f");
            };
            var nil_1 = function () {
                __classPrivateFieldSet(_this, _Task_changed, system_1.UNSET !== __classPrivateFieldGet(_this, _Task_value, "f"), "f");
                __classPrivateFieldSet(_this, _Task_value, system_1.UNSET, "f");
                __classPrivateFieldSet(_this, _Task_error, undefined, "f");
            };
            var err_1 = function (e) {
                var newError = (0, errors_1.createError)(e);
                __classPrivateFieldSet(_this, _Task_changed, !__classPrivateFieldGet(_this, _Task_error, "f") ||
                    newError.name !== __classPrivateFieldGet(_this, _Task_error, "f").name ||
                    newError.message !== __classPrivateFieldGet(_this, _Task_error, "f").message, "f");
                __classPrivateFieldSet(_this, _Task_value, system_1.UNSET, "f");
                __classPrivateFieldSet(_this, _Task_error, newError, "f");
            };
            var settle_1 = function (fn) {
                return function (arg) {
                    var _a;
                    __classPrivateFieldSet(_this, _Task_computing, false, "f");
                    __classPrivateFieldSet(_this, _Task_controller, undefined, "f");
                    fn(arg);
                    if (__classPrivateFieldGet(_this, _Task_changed, "f") && !(0, system_1.notifyOf)(_this))
                        (_a = __classPrivateFieldGet(_this, _Task_watcher, "f")) === null || _a === void 0 ? void 0 : _a.stop();
                };
            };
            // Own watcher: called by notifyOf() in upstream signals (push)
            __classPrivateFieldSet(this, _Task_watcher, (0, system_1.createWatcher)(function () {
                var _a, _b;
                __classPrivateFieldSet(_this, _Task_dirty, true, "f");
                (_a = __classPrivateFieldGet(_this, _Task_controller, "f")) === null || _a === void 0 ? void 0 : _a.abort();
                if (!(0, system_1.notifyOf)(_this))
                    (_b = __classPrivateFieldGet(_this, _Task_watcher, "f")) === null || _b === void 0 ? void 0 : _b.stop();
            }, function () {
                if (__classPrivateFieldGet(_this, _Task_computing, "f"))
                    throw new errors_1.CircularDependencyError('task');
                __classPrivateFieldSet(_this, _Task_changed, false, "f");
                // Return current value until promise resolves
                if (__classPrivateFieldGet(_this, _Task_controller, "f"))
                    return __classPrivateFieldGet(_this, _Task_value, "f");
                __classPrivateFieldSet(_this, _Task_controller, new AbortController(), "f");
                __classPrivateFieldGet(_this, _Task_controller, "f").signal.addEventListener('abort', function () {
                    __classPrivateFieldSet(_this, _Task_computing, false, "f");
                    __classPrivateFieldSet(_this, _Task_controller, undefined, "f");
                    // Retry computation with updated state
                    __classPrivateFieldGet(_this, _Task_instances, "m", _Task_getWatcher).call(_this).run();
                }, {
                    once: true,
                });
                var result;
                __classPrivateFieldSet(_this, _Task_computing, true, "f");
                try {
                    result = __classPrivateFieldGet(_this, _Task_callback, "f").call(_this, __classPrivateFieldGet(_this, _Task_value, "f"), __classPrivateFieldGet(_this, _Task_controller, "f").signal);
                }
                catch (e) {
                    if ((0, util_1.isAbortError)(e))
                        nil_1();
                    else
                        err_1(e);
                    __classPrivateFieldSet(_this, _Task_computing, false, "f");
                    return;
                }
                if (result instanceof Promise)
                    result.then(settle_1(ok_1), settle_1(err_1));
                else if (null == result || system_1.UNSET === result)
                    nil_1();
                else
                    ok_1(result);
                __classPrivateFieldSet(_this, _Task_computing, false, "f");
            }), "f");
            __classPrivateFieldGet(this, _Task_watcher, "f").onCleanup(function () {
                var _a;
                (_a = __classPrivateFieldGet(_this, _Task_controller, "f")) === null || _a === void 0 ? void 0 : _a.abort();
                __classPrivateFieldSet(_this, _Task_controller, undefined, "f");
                __classPrivateFieldSet(_this, _Task_watcher, undefined, "f");
            });
        }
        return __classPrivateFieldGet(this, _Task_watcher, "f");
    }, Symbol.toStringTag), {
        get: function () {
            return TYPE_COMPUTED;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Return the memoized value after executing the async function if necessary.
     *
     * @returns {T}
     * @throws {CircularDependencyError} If a circular dependency is detected
     * @throws {Error} If an error occurs during computation
     */
    Task.prototype.get = function () {
        (0, system_1.subscribeTo)(this);
        (0, system_1.flush)();
        if (__classPrivateFieldGet(this, _Task_dirty, "f"))
            __classPrivateFieldGet(this, _Task_instances, "m", _Task_getWatcher).call(this).run();
        if (__classPrivateFieldGet(this, _Task_error, "f"))
            throw __classPrivateFieldGet(this, _Task_error, "f");
        return __classPrivateFieldGet(this, _Task_value, "f");
    };
    return Task;
}());
exports.Task = Task;
/* === Functions === */
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {MemoCallback<T> | TaskCallback<T>} callback - Computation callback function
 * @param {ComputedOptions<T>} options - Optional configuration
 */
var createComputed = function (callback, options) {
    return (0, util_1.isAsyncFunction)(callback)
        ? new Task(callback, options)
        : new Memo(callback, options);
};
exports.createComputed = createComputed;
/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a computed signal, false otherwise
 */
var isComputed = /*#__PURE__*/ function (value) { return (0, util_1.isObjectOfType)(value, TYPE_COMPUTED); };
exports.isComputed = isComputed;
/**
 * Check if the provided value is a callback that may be used as input for createSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a sync callback, false otherwise
 */
var isMemoCallback = /*#__PURE__*/ function (value) { return (0, util_1.isSyncFunction)(value) && value.length < 2; };
exports.isMemoCallback = isMemoCallback;
/**
 * Check if the provided value is a callback that may be used as input for createSignal() to derive a computed state
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is an async callback, false otherwise
 */
var isTaskCallback = /*#__PURE__*/ function (value) { return (0, util_1.isAsyncFunction)(value) && value.length < 3; };
exports.isTaskCallback = isTaskCallback;
