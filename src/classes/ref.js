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
var _Ref_value;
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRef = exports.Ref = exports.TYPE_REF = void 0;
var errors_1 = require("../errors");
var system_1 = require("../system");
var util_1 = require("../util");
/* === Constants === */
var TYPE_REF = 'Ref';
exports.TYPE_REF = TYPE_REF;
/* === Class === */
/**
 * Create a new ref signal.
 *
 * @since 0.17.1
 * @param {T} value - Reference to external object
 * @param {Guard<T>} guard - Optional guard function to validate the value
 * @throws {NullishSignalValueError} - If the value is null or undefined
 * @throws {InvalidSignalValueError} - If the value is invalid
 */
var Ref = /** @class */ (function () {
    function Ref(value, options) {
        _Ref_value.set(this, void 0);
        (0, errors_1.validateSignalValue)(TYPE_REF, value, options === null || options === void 0 ? void 0 : options.guard);
        __classPrivateFieldSet(this, _Ref_value, value, "f");
        if (options === null || options === void 0 ? void 0 : options.watched)
            (0, system_1.registerWatchCallbacks)(this, options.watched, options.unwatched);
    }
    Object.defineProperty(Ref.prototype, (_Ref_value = new WeakMap(), Symbol.toStringTag), {
        get: function () {
            return TYPE_REF;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Get the value of the ref signal.
     *
     * @returns {T} - Object reference
     */
    Ref.prototype.get = function () {
        (0, system_1.subscribeTo)(this);
        return __classPrivateFieldGet(this, _Ref_value, "f");
    };
    /**
     * Notify watchers of relevant changes in the external reference.
     */
    Ref.prototype.notify = function () {
        (0, system_1.notifyOf)(this);
    };
    return Ref;
}());
exports.Ref = Ref;
/* === Functions === */
/**
 * Check if the provided value is a Ref instance
 *
 * @since 0.17.1
 * @param {unknown} value - Value to check
 * @returns {boolean} - Whether the value is a Ref instance
 */
var isRef = /*#__PURE__*/ function (value) {
    return (0, util_1.isObjectOfType)(value, TYPE_REF);
};
exports.isRef = isRef;
