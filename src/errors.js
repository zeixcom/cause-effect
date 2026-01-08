"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardMutableSignal = exports.validateSignalValue = exports.validateCallback = exports.createError = exports.ReadonlySignalError = exports.NullishSignalValueError = exports.InvalidSignalValueError = exports.InvalidHookError = exports.InvalidCollectionSourceError = exports.InvalidCallbackError = exports.DuplicateKeyError = exports.CircularDependencyError = void 0;
exports.assert = assert;
var signal_1 = require("./signal");
var system_1 = require("./system");
var util_1 = require("./util");
/* === Classes === */
var CircularDependencyError = /** @class */ (function (_super) {
    __extends(CircularDependencyError, _super);
    function CircularDependencyError(where) {
        var _this = _super.call(this, "Circular dependency detected in ".concat(where)) || this;
        _this.name = 'CircularDependencyError';
        return _this;
    }
    return CircularDependencyError;
}(Error));
exports.CircularDependencyError = CircularDependencyError;
var DuplicateKeyError = /** @class */ (function (_super) {
    __extends(DuplicateKeyError, _super);
    function DuplicateKeyError(where, key, value) {
        var _this = _super.call(this, "Could not add ".concat(where, " key \"").concat(key, "\"").concat(value ? " with value ".concat((0, util_1.valueString)(value)) : '', " because it already exists")) || this;
        _this.name = 'DuplicateKeyError';
        return _this;
    }
    return DuplicateKeyError;
}(Error));
exports.DuplicateKeyError = DuplicateKeyError;
var FailedAssertionError = /** @class */ (function (_super) {
    __extends(FailedAssertionError, _super);
    function FailedAssertionError(message) {
        if (message === void 0) { message = 'unexpected condition'; }
        var _this = _super.call(this, "Assertion failed: ".concat(message)) || this;
        _this.name = 'FailedAssertionError';
        return _this;
    }
    return FailedAssertionError;
}(Error));
var InvalidCallbackError = /** @class */ (function (_super) {
    __extends(InvalidCallbackError, _super);
    function InvalidCallbackError(where, value) {
        var _this = _super.call(this, "Invalid ".concat(where, " callback ").concat((0, util_1.valueString)(value))) || this;
        _this.name = 'InvalidCallbackError';
        return _this;
    }
    return InvalidCallbackError;
}(TypeError));
exports.InvalidCallbackError = InvalidCallbackError;
var InvalidCollectionSourceError = /** @class */ (function (_super) {
    __extends(InvalidCollectionSourceError, _super);
    function InvalidCollectionSourceError(where, value) {
        var _this = _super.call(this, "Invalid ".concat(where, " source ").concat((0, util_1.valueString)(value))) || this;
        _this.name = 'InvalidCollectionSourceError';
        return _this;
    }
    return InvalidCollectionSourceError;
}(TypeError));
exports.InvalidCollectionSourceError = InvalidCollectionSourceError;
var InvalidHookError = /** @class */ (function (_super) {
    __extends(InvalidHookError, _super);
    function InvalidHookError(where, type) {
        var _this = _super.call(this, "Invalid hook \"".concat(type, "\" in  ").concat(where)) || this;
        _this.name = 'InvalidHookError';
        return _this;
    }
    return InvalidHookError;
}(TypeError));
exports.InvalidHookError = InvalidHookError;
var InvalidSignalValueError = /** @class */ (function (_super) {
    __extends(InvalidSignalValueError, _super);
    function InvalidSignalValueError(where, value) {
        var _this = _super.call(this, "Invalid signal value ".concat((0, util_1.valueString)(value), " in ").concat(where)) || this;
        _this.name = 'InvalidSignalValueError';
        return _this;
    }
    return InvalidSignalValueError;
}(TypeError));
exports.InvalidSignalValueError = InvalidSignalValueError;
var NullishSignalValueError = /** @class */ (function (_super) {
    __extends(NullishSignalValueError, _super);
    function NullishSignalValueError(where) {
        var _this = _super.call(this, "Nullish signal values are not allowed in ".concat(where)) || this;
        _this.name = 'NullishSignalValueError';
        return _this;
    }
    return NullishSignalValueError;
}(TypeError));
exports.NullishSignalValueError = NullishSignalValueError;
var ReadonlySignalError = /** @class */ (function (_super) {
    __extends(ReadonlySignalError, _super);
    function ReadonlySignalError(what, value) {
        var _this = _super.call(this, "Could not set ".concat(what, " to ").concat((0, util_1.valueString)(value), " because signal is read-only")) || this;
        _this.name = 'ReadonlySignalError';
        return _this;
    }
    return ReadonlySignalError;
}(Error));
exports.ReadonlySignalError = ReadonlySignalError;
/* === Functions === */
function assert(condition, msg) {
    if (!condition)
        throw new FailedAssertionError(msg);
}
var createError = /*#__PURE__*/ function (reason) {
    return reason instanceof Error ? reason : Error(String(reason));
};
exports.createError = createError;
var validateCallback = function (where, value, guard) {
    if (guard === void 0) { guard = util_1.isFunction; }
    if (!guard(value))
        throw new InvalidCallbackError(where, value);
};
exports.validateCallback = validateCallback;
var validateSignalValue = function (where, value, guard) {
    if (guard === void 0) { guard = function () {
        return !((0, util_1.isSymbol)(value) && value !== system_1.UNSET) || (0, util_1.isFunction)(value);
    }; }
    if (value == null)
        throw new NullishSignalValueError(where);
    if (!guard(value))
        throw new InvalidSignalValueError(where, value);
};
exports.validateSignalValue = validateSignalValue;
var guardMutableSignal = function (what, value, signal) {
    if (!(0, signal_1.isMutableSignal)(signal))
        throw new ReadonlySignalError(what, value);
    return true;
};
exports.guardMutableSignal = guardMutableSignal;
