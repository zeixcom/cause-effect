"use strict";
/* === Utility Functions === */
Object.defineProperty(exports, "__esModule", { value: true });
exports.valueString = exports.isAbortError = exports.hasMethod = exports.isUniformArray = exports.isRecordOrArray = exports.isRecord = exports.isObjectOfType = exports.isNonNullObject = exports.isSyncFunction = exports.isAsyncFunction = exports.isFunction = exports.isSymbol = exports.isNumber = exports.isString = void 0;
var isString = /*#__PURE__*/ function (value) {
    return typeof value === 'string';
};
exports.isString = isString;
var isNumber = /*#__PURE__*/ function (value) {
    return typeof value === 'number';
};
exports.isNumber = isNumber;
var isSymbol = /*#__PURE__*/ function (value) {
    return typeof value === 'symbol';
};
exports.isSymbol = isSymbol;
var isFunction = /*#__PURE__*/ function (fn) { return typeof fn === 'function'; };
exports.isFunction = isFunction;
var isAsyncFunction = /*#__PURE__*/ function (fn) {
    return isFunction(fn) && fn.constructor.name === 'AsyncFunction';
};
exports.isAsyncFunction = isAsyncFunction;
var isSyncFunction = /*#__PURE__*/ function (fn) {
    return isFunction(fn) && fn.constructor.name !== 'AsyncFunction';
};
exports.isSyncFunction = isSyncFunction;
var isNonNullObject = /*#__PURE__*/ function (value) { return value != null && typeof value === 'object'; };
exports.isNonNullObject = isNonNullObject;
var isObjectOfType = /*#__PURE__*/ function (value, type) { return Object.prototype.toString.call(value) === "[object ".concat(type, "]"); };
exports.isObjectOfType = isObjectOfType;
var isRecord = /*#__PURE__*/ function (value) { return isObjectOfType(value, 'Object'); };
exports.isRecord = isRecord;
var isRecordOrArray = /*#__PURE__*/ function (value) { return isRecord(value) || Array.isArray(value); };
exports.isRecordOrArray = isRecordOrArray;
var isUniformArray = function (value, guard) {
    if (guard === void 0) { guard = function (item) { return item != null; }; }
    return Array.isArray(value) && value.every(guard);
};
exports.isUniformArray = isUniformArray;
var hasMethod = /*#__PURE__*/ function (obj, methodName) {
    return methodName in obj && isFunction(obj[methodName]);
};
exports.hasMethod = hasMethod;
var isAbortError = /*#__PURE__*/ function (error) {
    return error instanceof DOMException && error.name === 'AbortError';
};
exports.isAbortError = isAbortError;
var valueString = /*#__PURE__*/ function (value) {
    return isString(value)
        ? "\"".concat(value, "\"")
        : !!value && typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
};
exports.valueString = valueString;
