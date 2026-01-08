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
exports.match = match;
var errors_1 = require("./errors");
/* === Functions === */
/**
 * Match on resolve result and call appropriate handler for side effects
 *
 * This is a utility function for those who prefer the handler pattern.
 * All handlers are for side effects only and return void. If you need
 * cleanup logic, use a hoisted let variable in your effect.
 *
 * @since 0.15.0
 * @param {ResolveResult<S>} result - Result from resolve()
 * @param {MatchHandlers<S>} handlers - Handlers for different states (side effects only)
 * @returns {void} - Always returns void
 */
function match(result, handlers) {
    var _a, _b;
    try {
        if (result.pending)
            (_a = handlers.nil) === null || _a === void 0 ? void 0 : _a.call(handlers);
        else if (result.errors)
            (_b = handlers.err) === null || _b === void 0 ? void 0 : _b.call(handlers, result.errors);
        else if (result.ok)
            handlers.ok(result.values);
    }
    catch (e) {
        var error = (0, errors_1.createError)(e);
        if (handlers.err && (!result.errors || !result.errors.includes(error)))
            handlers.err(result.errors ? __spreadArray(__spreadArray([], result.errors, true), [error], false) : [error]);
        else
            throw error;
    }
}
