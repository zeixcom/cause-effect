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
var _State_value;
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = exports.isState = exports.TYPE_STATE = void 0;
var diff_1 = require("../diff");
var errors_1 = require("../errors");
var system_1 = require("../system");
var util_1 = require("../util");
/* === Constants === */
var TYPE_STATE = 'State';
exports.TYPE_STATE = TYPE_STATE;
/* === Class === */
/**
 * Create a new state signal.
 *
 * @since 0.17.0
 * @param {T} initialValue - Initial value of the state
 * @throws {NullishSignalValueError} - If the initial value is null or undefined
 * @throws {InvalidSignalValueError} - If the initial value is invalid
 */
var State = /** @class */ (function () {
    function State(initialValue, options) {
        _State_value.set(this, void 0);
        (0, errors_1.validateSignalValue)(TYPE_STATE, initialValue, options === null || options === void 0 ? void 0 : options.guard);
        __classPrivateFieldSet(this, _State_value, initialValue, "f");
        if (options === null || options === void 0 ? void 0 : options.watched)
            (0, system_1.registerWatchCallbacks)(this, options.watched, options.unwatched);
    }
    Object.defineProperty(State.prototype, (_State_value = new WeakMap(), Symbol.toStringTag), {
        get: function () {
            return TYPE_STATE;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Get the current value of the state signal.
     *
     * @returns {T} - Current value of the state
     */
    State.prototype.get = function () {
        (0, system_1.subscribeTo)(this);
        return __classPrivateFieldGet(this, _State_value, "f");
    };
    /**
     * Set the value of the state signal.
     *
     * @param {T} newValue - New value of the state
     * @returns {void}
     * @throws {NullishSignalValueError} - If the initial value is null or undefined
     * @throws {InvalidSignalValueError} - If the initial value is invalid
     */
    State.prototype.set = function (newValue) {
        (0, errors_1.validateSignalValue)(TYPE_STATE, newValue);
        if ((0, diff_1.isEqual)(__classPrivateFieldGet(this, _State_value, "f"), newValue))
            return;
        __classPrivateFieldSet(this, _State_value, newValue, "f");
        (0, system_1.notifyOf)(this);
        // Setting to UNSET clears the watchers so the signal can be garbage collected
        if (system_1.UNSET === __classPrivateFieldGet(this, _State_value, "f"))
            (0, system_1.unsubscribeAllFrom)(this);
    };
    /**
     * Update the value of the state signal.
     *
     * @param {Function} updater - Function that takes the current value and returns the new value
     * @returns {void}
     * @throws {InvalidCallbackError} - If the updater function is not a function
     * @throws {NullishSignalValueError} - If the initial value is null or undefined
     * @throws {InvalidSignalValueError} - If the initial value is invalid
     */
    State.prototype.update = function (updater) {
        (0, errors_1.validateCallback)("".concat(TYPE_STATE, " update"), updater);
        this.set(updater(__classPrivateFieldGet(this, _State_value, "f")));
    };
    return State;
}());
exports.State = State;
/* === Functions === */
/**
 * Check if the provided value is a State instance
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a State instance, false otherwise
 */
var isState = /*#__PURE__*/ function (value) { return (0, util_1.isObjectOfType)(value, TYPE_STATE); };
exports.isState = isState;
