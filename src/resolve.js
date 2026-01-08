"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = resolve;
var errors_1 = require("./errors");
var system_1 = require("./system");
/* === Functions === */
/**
 * Resolve signal values with perfect type inference
 *
 * Always returns a discriminated union result, regardless of whether
 * handlers are provided or not. This ensures a predictable API.
 *
 * @since 0.15.0
 * @param {S} signals - Signals to resolve
 * @returns {ResolveResult<S>} - Discriminated union result
 */
function resolve(signals) {
    var errors = [];
    var pending = false;
    var values = {};
    // Collect values and errors
    for (var _i = 0, _a = Object.entries(signals); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], signal = _b[1];
        try {
            var value = signal.get();
            if (value === system_1.UNSET)
                pending = true;
            else
                values[key] = value;
        }
        catch (e) {
            errors.push((0, errors_1.createError)(e));
        }
    }
    // Return discriminated union
    if (pending)
        return { ok: false, pending: true };
    if (errors.length > 0)
        return { ok: false, errors: errors };
    return { ok: true, values: values };
}
