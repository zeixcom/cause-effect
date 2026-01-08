"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMemoCallback = exports.isMemo = exports.createMemo = exports.TYPE_MEMO = void 0;
var errors_1 = require("../src/errors");
var system_1 = require("../src/system");
var util_1 = require("../src/util");
/* === Constants === */
var TYPE_MEMO = 'Memo';
exports.TYPE_MEMO = TYPE_MEMO;
/* === Functions === */
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {MemoCallback<T>} callback - Computation callback function
 * @returns {Memo<T>} - Computed signal
 */
var createMemo = function (callback, initialValue) {
    var _a;
    if (initialValue === void 0) { initialValue = system_1.UNSET; }
    if (!isMemoCallback(callback))
        throw new errors_1.InvalidCallbackError('memo', callback);
    if (initialValue == null)
        throw new errors_1.NullishSignalValueError('memo');
    var watchers = new Set();
    // Internal state
    var value = initialValue;
    var error;
    var dirty = true;
    var computing = false;
    // Own watcher: called when notified from sources (push)
    var watcher = (0, system_1.createWatcher)(function () {
        dirty = true;
        if (watchers.size)
            (0, system_1.notifyWatchers)(watchers);
        else
            watcher.stop();
    }, function () {
        if (computing)
            throw new errors_1.CircularDependencyError('memo');
        var result;
        computing = true;
        try {
            result = callback(value);
        }
        catch (e) {
            // Err track
            value = system_1.UNSET;
            error = (0, errors_1.createError)(e);
            computing = false;
            return;
        }
        if (null == result || system_1.UNSET === result) {
            // Nil track
            value = system_1.UNSET;
            error = undefined;
        }
        else {
            // Ok track
            value = result;
            error = undefined;
            dirty = false;
        }
        computing = false;
    });
    var memo = {};
    Object.defineProperties(memo, (_a = {},
        _a[Symbol.toStringTag] = {
            value: TYPE_MEMO,
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
    return memo;
};
exports.createMemo = createMemo;
/**
 * Check if a value is a memoized signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a memo signal, false otherwise
 */
var isMemo = /*#__PURE__*/ function (value) {
    return (0, util_1.isObjectOfType)(value, TYPE_MEMO);
};
exports.isMemo = isMemo;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a sync callback, false otherwise
 */
var isMemoCallback = /*#__PURE__*/ function (value) { return (0, util_1.isSyncFunction)(value) && value.length < 2; };
exports.isMemoCallback = isMemoCallback;
