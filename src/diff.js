"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEqual = exports.diff = void 0;
var errors_1 = require("./errors");
var system_1 = require("./system");
var util_1 = require("./util");
/* === Functions === */
/**
 * Checks if two values are equal with cycle detection
 *
 * @since 0.15.0
 * @param {T} a - First value to compare
 * @param {T} b - Second value to compare
 * @param {WeakSet<object>} visited - Set to track visited objects for cycle detection
 * @returns {boolean} Whether the two values are equal
 */
var isEqual = function (a, b, visited) {
    // Fast paths
    if (Object.is(a, b))
        return true;
    if (typeof a !== typeof b)
        return false;
    if (!(0, util_1.isNonNullObject)(a) || !(0, util_1.isNonNullObject)(b))
        return false;
    // Cycle detection
    if (!visited)
        visited = new WeakSet();
    if (visited.has(a) || visited.has(b))
        throw new errors_1.CircularDependencyError('isEqual');
    visited.add(a);
    visited.add(b);
    try {
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length)
                return false;
            for (var i = 0; i < a.length; i++) {
                if (!isEqual(a[i], b[i], visited))
                    return false;
            }
            return true;
        }
        if (Array.isArray(a) !== Array.isArray(b))
            return false;
        if ((0, util_1.isRecord)(a) && (0, util_1.isRecord)(b)) {
            var aKeys = Object.keys(a);
            var bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length)
                return false;
            for (var _i = 0, aKeys_1 = aKeys; _i < aKeys_1.length; _i++) {
                var key = aKeys_1[_i];
                if (!(key in b))
                    return false;
                if (!isEqual(a[key], b[key], visited))
                    return false;
            }
            return true;
        }
        // For non-records/non-arrays, they are only equal if they are the same reference
        // (which would have been caught by Object.is at the beginning)
        return false;
    }
    finally {
        visited.delete(a);
        visited.delete(b);
    }
};
exports.isEqual = isEqual;
/**
 * Compares two records and returns a result object containing the differences.
 *
 * @since 0.15.0
 * @param {T} oldObj - The old record to compare
 * @param {T} newObj - The new record to compare
 * @returns {DiffResult} The result of the comparison
 */
var diff = function (oldObj, newObj) {
    // Guard against non-objects that can't be diffed properly with Object.keys and 'in' operator
    var oldValid = (0, util_1.isRecordOrArray)(oldObj);
    var newValid = (0, util_1.isRecordOrArray)(newObj);
    if (!oldValid || !newValid) {
        // For non-objects or non-plain objects, treat as complete change if different
        var changed = !Object.is(oldObj, newObj);
        return {
            changed: changed,
            add: changed && newValid ? newObj : {},
            change: {},
            remove: changed && oldValid ? oldObj : {},
        };
    }
    var visited = new WeakSet();
    var add = {};
    var change = {};
    var remove = {};
    var oldKeys = Object.keys(oldObj);
    var newKeys = Object.keys(newObj);
    var allKeys = new Set(__spreadArray(__spreadArray([], oldKeys, true), newKeys, true));
    for (var _i = 0, allKeys_1 = allKeys; _i < allKeys_1.length; _i++) {
        var key = allKeys_1[_i];
        var oldHas = key in oldObj;
        var newHas = key in newObj;
        if (!oldHas && newHas) {
            add[key] = newObj[key];
            continue;
        }
        else if (oldHas && !newHas) {
            remove[key] = system_1.UNSET;
            continue;
        }
        var oldValue = oldObj[key];
        var newValue = newObj[key];
        if (!isEqual(oldValue, newValue, visited))
            change[key] = newValue;
    }
    return {
        add: add,
        change: change,
        remove: remove,
        changed: !!(Object.keys(add).length ||
            Object.keys(change).length ||
            Object.keys(remove).length),
    };
};
exports.diff = diff;
