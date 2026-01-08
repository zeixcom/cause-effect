"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSignal = exports.isMutableSignal = void 0;
exports.createMutableSignal = createMutableSignal;
exports.createSignal = createSignal;
var computed_1 = require("./classes/computed");
var list_1 = require("./classes/list");
var state_1 = require("./classes/state");
var store_1 = require("./classes/store");
var util_1 = require("./util");
/* === Functions === */
/**
 * Check whether a value is a Signal
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
var isSignal = /*#__PURE__*/ function (value) { return (0, state_1.isState)(value) || (0, computed_1.isComputed)(value) || (0, store_1.isStore)(value); };
exports.isSignal = isSignal;
/**
 * Check whether a value is a State, Store, or List
 *
 * @since 0.15.2
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a State, Store, or List, false otherwise
 */
var isMutableSignal = /*#__PURE__*/ function (value) {
    return (0, state_1.isState)(value) || (0, store_1.isStore)(value) || (0, list_1.isList)(value);
};
exports.isMutableSignal = isMutableSignal;
function createSignal(value) {
    if ((0, computed_1.isMemoCallback)(value))
        return new computed_1.Memo(value);
    if ((0, computed_1.isTaskCallback)(value))
        return new computed_1.Task(value);
    if ((0, util_1.isUniformArray)(value))
        return new list_1.List(value);
    if ((0, util_1.isRecord)(value))
        return (0, store_1.createStore)(value);
    return new state_1.State(value);
}
function createMutableSignal(value) {
    if ((0, util_1.isUniformArray)(value))
        return new list_1.List(value);
    if ((0, util_1.isRecord)(value))
        return (0, store_1.createStore)(value);
    return new state_1.State(value);
}
