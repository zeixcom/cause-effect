"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createState = exports.isState = exports.TYPE_STATE = void 0;
var diff_1 = require("../src/diff");
var errors_1 = require("../src/errors");
var system_1 = require("../src/system");
var util_1 = require("../src/util");
/* === Constants === */
var TYPE_STATE = 'State';
exports.TYPE_STATE = TYPE_STATE;
/* === Functions === */
/**
 * Create a new state signal
 *
 * @since 0.9.0
 * @param {T} initialValue - initial value of the state
 * @returns {State<T>} - new state signal
 */
var createState = /*#__PURE__*/ function (initialValue) {
    var _a;
    if (initialValue == null)
        throw new errors_1.NullishSignalValueError('state');
    var watchers = new Set();
    var value = initialValue;
    var setValue = function (newValue) {
        if (newValue == null)
            throw new errors_1.NullishSignalValueError('state');
        if ((0, diff_1.isEqual)(value, newValue))
            return;
        value = newValue;
        (0, system_1.notifyWatchers)(watchers);
        // Setting to UNSET clears the watchers so the signal can be garbage collected
        if (system_1.UNSET === value)
            watchers.clear();
    };
    var state = {};
    Object.defineProperties(state, (_a = {},
        _a[Symbol.toStringTag] = {
            value: TYPE_STATE,
        },
        _a.get = {
            value: function () {
                (0, system_1.subscribeActiveWatcher)(watchers);
                return value;
            },
        },
        _a.set = {
            value: function (newValue) {
                setValue(newValue);
            },
        },
        _a.update = {
            value: function (updater) {
                if (!(0, util_1.isFunction)(updater))
                    throw new errors_1.InvalidCallbackError('state update', updater);
                setValue(updater(value));
            },
        },
        _a));
    return state;
};
exports.createState = createState;
/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if the value is a State instance, false otherwise
 */
var isState = /*#__PURE__*/ function (value) { return (0, util_1.isObjectOfType)(value, TYPE_STATE); };
exports.isState = isState;
