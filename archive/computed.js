"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isComputedCallback = exports.isComputed = exports.createComputed = exports.TYPE_COMPUTED = void 0;
var diff_1 = require("../src/diff");
var errors_1 = require("../src/errors");
var system_1 = require("../src/system");
var util_1 = require("../src/util");
/* === Constants === */
var TYPE_COMPUTED = 'Computed';
exports.TYPE_COMPUTED = TYPE_COMPUTED;
/* === Functions === */
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {ComputedCallback<T>} callback - Computation callback function
 * @returns {Computed<T>} - Computed signal
 */
var createComputed = function (callback, initialValue) {
    var _a;
    if (initialValue === void 0) { initialValue = system_1.UNSET; }
    if (!isComputedCallback(callback))
        throw new errors_1.InvalidCallbackError('computed', callback);
    if (initialValue == null)
        throw new errors_1.NullishSignalValueError('computed');
    var watchers = new Set();
    // Internal state
    var value = initialValue;
    var error;
    var controller;
    var dirty = true;
    var changed = false;
    var computing = false;
    // Functions to update internal state
    var ok = function (v) {
        if (!(0, diff_1.isEqual)(v, value)) {
            value = v;
            changed = true;
        }
        error = undefined;
        dirty = false;
    };
    var nil = function () {
        changed = system_1.UNSET !== value;
        value = system_1.UNSET;
        error = undefined;
    };
    var err = function (e) {
        var newError = (0, errors_1.createError)(e);
        changed =
            !error ||
                newError.name !== error.name ||
                newError.message !== error.message;
        value = system_1.UNSET;
        error = newError;
    };
    var settle = function (fn) {
        return function (arg) {
            computing = false;
            controller = undefined;
            fn(arg);
            if (changed)
                (0, system_1.notifyWatchers)(watchers);
        };
    };
    // Own watcher: called when notified from sources (push)
    var watcher = (0, system_1.createWatcher)(function () {
        dirty = true;
        controller === null || controller === void 0 ? void 0 : controller.abort();
        if (watchers.size)
            (0, system_1.notifyWatchers)(watchers);
        else
            watcher.stop();
    }, function () {
        if (computing)
            throw new errors_1.CircularDependencyError('computed');
        changed = false;
        if ((0, util_1.isAsyncFunction)(callback)) {
            // Return current value until promise resolves
            if (controller)
                return value;
            controller = new AbortController();
            controller.signal.addEventListener('abort', function () {
                computing = false;
                controller = undefined;
                watcher.run(); // Retry computation with updated state
            }, {
                once: true,
            });
        }
        var result;
        computing = true;
        try {
            result = controller
                ? callback(value, controller.signal)
                : callback(value);
        }
        catch (e) {
            if ((0, util_1.isAbortError)(e))
                nil();
            else
                err(e);
            computing = false;
            return;
        }
        if (result instanceof Promise)
            result.then(settle(ok), settle(err));
        else if (null == result || system_1.UNSET === result)
            nil();
        else
            ok(result);
        computing = false;
    });
    watcher.onCleanup(function () {
        controller === null || controller === void 0 ? void 0 : controller.abort();
    });
    var computed = {};
    Object.defineProperties(computed, (_a = {},
        _a[Symbol.toStringTag] = {
            value: TYPE_COMPUTED,
        },
        _a.get = {
            value: function () {
                (0, system_1.subscribeActiveWatcher)(watchers);
                (0, system_1.flush)();
                if (dirty)
                    watcher.run();
                if (error)
                    throw error;
                return value;
            },
        },
        _a));
    return computed;
};
exports.createComputed = createComputed;
/**
 * Check if a value is a computed signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - true if value is a computed signal, false otherwise
 */
var isComputed = /*#__PURE__*/ function (value) { return (0, util_1.isObjectOfType)(value, TYPE_COMPUTED); };
exports.isComputed = isComputed;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - true if value is a callback or callbacks object, false otherwise
 */
var isComputedCallback = /*#__PURE__*/ function (value) { return (0, util_1.isFunction)(value) && value.length < 3; };
exports.isComputedCallback = isComputedCallback;
