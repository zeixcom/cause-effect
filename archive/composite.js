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
var _Composite_validate, _Composite_create;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Composite = void 0;
var errors_1 = require("../src/errors");
var system_1 = require("../src/system");
/* === Class Definitions === */
var Composite = /** @class */ (function () {
    function Composite(values, validate, create) {
        this.signals = new Map();
        _Composite_validate.set(this, void 0);
        _Composite_create.set(this, void 0);
        __classPrivateFieldSet(this, _Composite_validate, validate, "f");
        __classPrivateFieldSet(this, _Composite_create, create, "f");
        this.change({
            add: values,
            change: {},
            remove: {},
            changed: true,
        });
    }
    Composite.prototype.add = function (key, value) {
        if (!__classPrivateFieldGet(this, _Composite_validate, "f").call(this, key, value))
            return false;
        this.signals.set(key, __classPrivateFieldGet(this, _Composite_create, "f").call(this, value));
        return true;
    };
    Composite.prototype.remove = function (key) {
        return this.signals.delete(key);
    };
    Composite.prototype.change = function (changes) {
        var _this = this;
        // Additions
        if (Object.keys(changes.add).length) {
            for (var key in changes.add)
                this.add(key, changes.add[key]);
        }
        // Changes
        if (Object.keys(changes.change).length) {
            (0, system_1.batch)(function () {
                for (var key in changes.change) {
                    var value = changes.change[key];
                    if (!__classPrivateFieldGet(_this, _Composite_validate, "f").call(_this, key, value))
                        continue;
                    var signal = _this.signals.get(key);
                    if ((0, errors_1.guardMutableSignal)("list item \"".concat(key, "\""), value, signal))
                        signal.set(value);
                }
            });
        }
        // Removals
        if (Object.keys(changes.remove).length) {
            for (var key in changes.remove)
                this.remove(key);
        }
        return changes.changed;
    };
    Composite.prototype.clear = function () {
        this.signals.clear();
        return true;
    };
    return Composite;
}());
exports.Composite = Composite;
_Composite_validate = new WeakMap(), _Composite_create = new WeakMap();
