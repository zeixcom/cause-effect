"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
var bun_test_1 = require("bun:test");
var index_ts_1 = require("../index.ts");
(0, bun_test_1.describe)('store', function () {
    (0, bun_test_1.describe)('creation and basic operations', function () {
        (0, bun_test_1.test)('creates BaseStore with initial values', function () {
            var user = new index_ts_1.BaseStore({
                name: 'Hannah',
                email: 'hannah@example.com',
            });
            (0, bun_test_1.expect)(user.byKey('name').get()).toBe('Hannah');
            (0, bun_test_1.expect)(user.byKey('email').get()).toBe('hannah@example.com');
        });
        (0, bun_test_1.test)('creates stores with initial values', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'Hannah',
                email: 'hannah@example.com',
            });
            (0, bun_test_1.expect)(user.name.get()).toBe('Hannah');
            (0, bun_test_1.expect)(user.email.get()).toBe('hannah@example.com');
        });
        (0, bun_test_1.test)('has Symbol.toStringTag of Store', function () {
            var store = (0, index_ts_1.createStore)({ a: 1 });
            (0, bun_test_1.expect)(store[Symbol.toStringTag]).toBe('Store');
        });
        (0, bun_test_1.test)('isStore identifies store instances correctly', function () {
            var store = (0, index_ts_1.createStore)({ a: 1 });
            var state = new index_ts_1.State(1);
            var computed = new index_ts_1.Memo(function () { return 1; });
            (0, bun_test_1.expect)((0, index_ts_1.isStore)(store)).toBe(true);
            (0, bun_test_1.expect)((0, index_ts_1.isStore)(state)).toBe(false);
            (0, bun_test_1.expect)((0, index_ts_1.isStore)(computed)).toBe(false);
            (0, bun_test_1.expect)((0, index_ts_1.isStore)({})).toBe(false);
        });
        (0, bun_test_1.test)('get() returns the complete store value', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'Alice',
                email: 'alice@example.com',
            });
            (0, bun_test_1.expect)(user.get()).toEqual({
                name: 'Alice',
                email: 'alice@example.com',
            });
        });
    });
    (0, bun_test_1.describe)('proxy data access and modification', function () {
        (0, bun_test_1.test)('properties can be accessed and modified via signals', function () {
            var user = (0, index_ts_1.createStore)({ name: 'John', age: 30 });
            (0, bun_test_1.expect)(user.name.get()).toBe('John');
            (0, bun_test_1.expect)(user.age.get()).toBe(30);
            user.name.set('Alicia');
            user.age.set(31);
            (0, bun_test_1.expect)(user.name.get()).toBe('Alicia');
            (0, bun_test_1.expect)(user.age.get()).toBe(31);
        });
        (0, bun_test_1.test)('returns undefined for non-existent properties', function () {
            var user = (0, index_ts_1.createStore)({ name: 'Alice' });
            // @ts-expect-error accessing non-existent property
            (0, bun_test_1.expect)(user.nonexistent).toBeUndefined();
        });
        (0, bun_test_1.test)('supports string key access', function () {
            var items = (0, index_ts_1.createStore)({ first: 'alpha', second: 'beta' });
            (0, bun_test_1.expect)(items.first.get()).toBe('alpha');
            (0, bun_test_1.expect)(items.second.get()).toBe('beta');
        });
    });
    (0, bun_test_1.describe)('add() and remove() methods', function () {
        (0, bun_test_1.test)('add() method adds new properties', function () {
            var _a, _b;
            var user = (0, index_ts_1.createStore)({
                name: 'John',
            });
            user.add('email', 'john@example.com');
            (0, bun_test_1.expect)((_a = user.byKey('email')) === null || _a === void 0 ? void 0 : _a.get()).toBe('john@example.com');
            (0, bun_test_1.expect)((_b = user.email) === null || _b === void 0 ? void 0 : _b.get()).toBe('john@example.com');
        });
        (0, bun_test_1.test)('remove() method removes properties', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
                email: 'john@example.com',
            });
            user.remove('email');
            (0, bun_test_1.expect)(user.byKey('email')).toBeUndefined();
            // expect(user.byKey('name').get()).toBe('John')
            (0, bun_test_1.expect)(user.email).toBeUndefined();
            // expect(user.name.get()).toBe('John')
        });
        (0, bun_test_1.test)('add method prevents null values', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
            });
            // @ts-expect-error testing null values
            (0, bun_test_1.expect)(function () { return user.add('email', null); }).toThrow();
        });
        (0, bun_test_1.test)('add method prevents overwriting existing properties', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
                email: 'john@example.com',
            });
            (0, bun_test_1.expect)(function () { return user.add('name', 'Jane'); }).toThrow();
        });
        (0, bun_test_1.test)('remove method handles non-existent properties gracefully', function () {
            var user = (0, index_ts_1.createStore)({ name: 'John' });
            (0, bun_test_1.expect)(function () { return user.remove('nonexistent'); }).not.toThrow();
        });
    });
    (0, bun_test_1.describe)('nested stores', function () {
        (0, bun_test_1.test)('creates nested stores for object properties', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'Alice',
                preferences: {
                    theme: 'light',
                    notifications: true,
                },
            });
            (0, bun_test_1.expect)(user.name.get()).toBe('Alice');
            (0, bun_test_1.expect)(user.preferences.theme.get()).toBe('light');
            (0, bun_test_1.expect)(user.preferences.notifications.get()).toBe(true);
        });
        (0, bun_test_1.test)('nested properties are reactive', function () {
            var user = (0, index_ts_1.createStore)({
                preferences: {
                    theme: 'light',
                },
            });
            var lastTheme = '';
            (0, index_ts_1.createEffect)(function () {
                lastTheme = user.preferences.theme.get();
            });
            (0, bun_test_1.expect)(lastTheme).toBe('light');
            user.preferences.theme.set('dark');
            (0, bun_test_1.expect)(lastTheme).toBe('dark');
        });
        (0, bun_test_1.test)('deeply nested stores work correctly', function () {
            var config = (0, index_ts_1.createStore)({
                ui: {
                    theme: {
                        colors: {
                            primary: '#007acc',
                        },
                    },
                },
            });
            (0, bun_test_1.expect)(config.ui.theme.colors.primary.get()).toBe('#007acc');
            config.ui.theme.colors.primary.set('#ff6600');
            (0, bun_test_1.expect)(config.ui.theme.colors.primary.get()).toBe('#ff6600');
        });
    });
    (0, bun_test_1.describe)('set() and update() methods', function () {
        (0, bun_test_1.test)('set() replaces entire store value', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
                email: 'john@example.com',
            });
            user.set({ name: 'Jane', email: 'jane@example.com' });
            (0, bun_test_1.expect)(user.name.get()).toBe('Jane');
            (0, bun_test_1.expect)(user.email.get()).toBe('jane@example.com');
        });
        (0, bun_test_1.test)('update() modifies store using function', function () {
            var user = (0, index_ts_1.createStore)({ name: 'John', age: 25 });
            user.update(function (u) { return (__assign(__assign({}, u), { age: u.age + 1 })); });
            (0, bun_test_1.expect)(user.name.get()).toBe('John');
            (0, bun_test_1.expect)(user.age.get()).toBe(26);
        });
    });
    (0, bun_test_1.describe)('iteration protocol', function () {
        (0, bun_test_1.test)('supports for...of iteration', function () {
            var user = (0, index_ts_1.createStore)({ name: 'John', age: 25 });
            var entries = __spreadArray([], user, true);
            (0, bun_test_1.expect)(entries).toHaveLength(2);
            (0, bun_test_1.expect)(entries[0][0]).toBe('name');
            (0, bun_test_1.expect)(entries[0][1].get()).toBe('John');
            (0, bun_test_1.expect)(entries[1][0]).toBe('age');
            (0, bun_test_1.expect)(entries[1][1].get()).toBe(25);
        });
        (0, bun_test_1.test)('Symbol.isConcatSpreadable is false', function () {
            var user = (0, index_ts_1.createStore)({ name: 'John', age: 25 });
            (0, bun_test_1.expect)(user[Symbol.isConcatSpreadable]).toBe(false);
        });
        (0, bun_test_1.test)('maintains property key ordering', function () {
            var config = (0, index_ts_1.createStore)({ alpha: 1, beta: 2, gamma: 3 });
            var keys = Object.keys(config);
            (0, bun_test_1.expect)(keys).toEqual(['alpha', 'beta', 'gamma']);
            var entries = __spreadArray([], config, true);
            (0, bun_test_1.expect)(entries.map(function (_a) {
                var key = _a[0], signal = _a[1];
                return [key, signal.get()];
            })).toEqual([
                ['alpha', 1],
                ['beta', 2],
                ['gamma', 3],
            ]);
        });
    });
    (0, bun_test_1.describe)('reactivity', function () {
        (0, bun_test_1.test)('store-level get() is reactive', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
                email: 'john@example.com',
            });
            var lastValue = { name: '', email: '' };
            (0, index_ts_1.createEffect)(function () {
                lastValue = user.get();
            });
            (0, bun_test_1.expect)(lastValue).toEqual({
                name: 'John',
                email: 'john@example.com',
            });
            user.name.set('Jane');
            user.email.set('jane@example.com');
            (0, bun_test_1.expect)(lastValue).toEqual({
                name: 'Jane',
                email: 'jane@example.com',
            });
        });
        (0, bun_test_1.test)('individual signal reactivity works', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
                email: 'john@example.com',
            });
            var lastName = '';
            var nameEffectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                lastName = user.name.get();
                nameEffectRuns++;
            });
            (0, bun_test_1.expect)(lastName).toBe('John');
            (0, bun_test_1.expect)(nameEffectRuns).toBe(1);
            user.name.set('Jane');
            (0, bun_test_1.expect)(lastName).toBe('Jane');
            (0, bun_test_1.expect)(nameEffectRuns).toBe(2);
        });
        (0, bun_test_1.test)('nested store changes propagate to parent', function () {
            var user = (0, index_ts_1.createStore)({
                preferences: {
                    theme: 'light',
                },
            });
            var effectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                user.get();
                effectRuns++;
            });
            (0, bun_test_1.expect)(effectRuns).toBe(1);
            user.preferences.theme.set('dark');
            (0, bun_test_1.expect)(effectRuns).toBe(2);
        });
        (0, bun_test_1.test)('updates are reactive', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
            });
            var lastValue = { name: '' };
            var effectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                lastValue = user.get();
                effectRuns++;
            });
            (0, bun_test_1.expect)(lastValue).toEqual({ name: 'John' });
            (0, bun_test_1.expect)(effectRuns).toBe(1);
            user.update(function (u) { return (__assign(__assign({}, u), { email: 'john@example.com' })); });
            (0, bun_test_1.expect)(lastValue).toEqual({
                name: 'John',
                email: 'john@example.com',
            });
            (0, bun_test_1.expect)(effectRuns).toBe(2);
        });
        (0, bun_test_1.test)('remove method is reactive', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'John',
                email: 'john@example.com',
                age: 30,
            });
            var lastValue = { name: '', email: '', age: 0 };
            var effectRuns = 0;
            (0, index_ts_1.createEffect)(function () {
                lastValue = user.get();
                effectRuns++;
            });
            (0, bun_test_1.expect)(lastValue).toEqual({
                name: 'John',
                email: 'john@example.com',
                age: 30,
            });
            (0, bun_test_1.expect)(effectRuns).toBe(1);
            user.remove('email');
            (0, bun_test_1.expect)(lastValue).toEqual({ name: 'John', age: 30 });
            (0, bun_test_1.expect)(effectRuns).toBe(2);
        });
    });
    (0, bun_test_1.describe)('computed integration', function () {
        (0, bun_test_1.test)('works with computed signals', function () {
            var user = (0, index_ts_1.createStore)({
                firstName: 'John',
                lastName: 'Doe',
            });
            var fullName = new index_ts_1.Memo(function () { return "".concat(user.firstName.get(), " ").concat(user.lastName.get()); });
            (0, bun_test_1.expect)(fullName.get()).toBe('John Doe');
            user.firstName.set('Jane');
            (0, bun_test_1.expect)(fullName.get()).toBe('Jane Doe');
        });
        (0, bun_test_1.test)('computed reacts to nested store changes', function () {
            var config = (0, index_ts_1.createStore)({
                ui: {
                    theme: 'light',
                },
            });
            var themeDisplay = new index_ts_1.Memo(function () { return "Theme: ".concat(config.ui.theme.get()); });
            (0, bun_test_1.expect)(themeDisplay.get()).toBe('Theme: light');
            config.ui.theme.set('dark');
            (0, bun_test_1.expect)(themeDisplay.get()).toBe('Theme: dark');
        });
    });
    (0, bun_test_1.describe)('proxy behavior and enumeration', function () {
        (0, bun_test_1.test)('Object.keys returns property keys', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'Alice',
                email: 'alice@example.com',
            });
            var userKeys = Object.keys(user);
            (0, bun_test_1.expect)(userKeys.sort()).toEqual(['email', 'name']);
        });
        (0, bun_test_1.test)('property enumeration works', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'Alice',
                email: 'alice@example.com',
            });
            var userKeys = [];
            for (var key in user) {
                userKeys.push(key);
            }
            (0, bun_test_1.expect)(userKeys.sort()).toEqual(['email', 'name']);
        });
        (0, bun_test_1.test)('in operator works', function () {
            var user = (0, index_ts_1.createStore)({ name: 'Alice' });
            (0, bun_test_1.expect)('name' in user).toBe(true);
            (0, bun_test_1.expect)('email' in user).toBe(false);
        });
        (0, bun_test_1.test)('Object.getOwnPropertyDescriptor works', function () {
            var user = (0, index_ts_1.createStore)({ name: 'Alice' });
            var nameDescriptor = Object.getOwnPropertyDescriptor(user, 'name');
            (0, bun_test_1.expect)(nameDescriptor).toEqual({
                enumerable: true,
                configurable: true,
                writable: true,
                value: user.name,
            });
        });
    });
    (0, bun_test_1.describe)('byKey() method', function () {
        (0, bun_test_1.test)('works with property keys', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'Alice',
                email: 'alice@example.com',
                age: 30,
            });
            var nameSignal = user.byKey('name');
            var emailSignal = user.byKey('email');
            var ageSignal = user.byKey('age');
            // @ts-expect-error deliberate access for nonexistent key
            var nonexistentSignal = user.byKey('nonexistent');
            (0, bun_test_1.expect)(nameSignal === null || nameSignal === void 0 ? void 0 : nameSignal.get()).toBe('Alice');
            (0, bun_test_1.expect)(emailSignal === null || emailSignal === void 0 ? void 0 : emailSignal.get()).toBe('alice@example.com');
            (0, bun_test_1.expect)(ageSignal === null || ageSignal === void 0 ? void 0 : ageSignal.get()).toBe(30);
            (0, bun_test_1.expect)(nonexistentSignal).toBeUndefined();
            // Verify these are the same signals as property access
            (0, bun_test_1.expect)(nameSignal).toBe(user.name);
            (0, bun_test_1.expect)(emailSignal).toBe(user.email);
            (0, bun_test_1.expect)(ageSignal).toBe(user.age);
        });
        (0, bun_test_1.test)('works with nested stores', function () {
            var app = (0, index_ts_1.createStore)({
                config: {
                    version: '1.0.0',
                },
            });
            var configStore = app.byKey('config');
            (0, bun_test_1.expect)(configStore === null || configStore === void 0 ? void 0 : configStore.get()).toEqual({ version: '1.0.0' });
            (0, bun_test_1.expect)(configStore).toBe(app.config);
        });
        (0, bun_test_1.test)('is reactive and works with computed signals', function () {
            var user = (0, index_ts_1.createStore)({
                name: 'Alice',
                age: 30,
            });
            var nameSignal = user.byKey('name');
            var displayName = new index_ts_1.Memo(function () {
                return nameSignal ? "Hello, ".concat(nameSignal.get(), "!") : 'Unknown';
            });
            (0, bun_test_1.expect)(displayName.get()).toBe('Hello, Alice!');
            nameSignal === null || nameSignal === void 0 ? void 0 : nameSignal.set('Bob');
            (0, bun_test_1.expect)(displayName.get()).toBe('Hello, Bob!');
        });
    });
    (0, bun_test_1.describe)('UNSET and edge cases', function () {
        (0, bun_test_1.test)('handles UNSET values', function () {
            var store = (0, index_ts_1.createStore)({ value: index_ts_1.UNSET });
            (0, bun_test_1.expect)(store.get()).toEqual({ value: index_ts_1.UNSET });
        });
        (0, bun_test_1.test)('handles primitive values', function () {
            var store = (0, index_ts_1.createStore)({
                str: 'hello',
                num: 42,
                bool: true,
            });
            (0, bun_test_1.expect)(store.str.get()).toBe('hello');
            (0, bun_test_1.expect)(store.num.get()).toBe(42);
            (0, bun_test_1.expect)(store.bool.get()).toBe(true);
        });
        (0, bun_test_1.test)('handles empty stores correctly', function () {
            var empty = (0, index_ts_1.createStore)({});
            (0, bun_test_1.expect)(empty.get()).toEqual({});
        });
    });
    (0, bun_test_1.describe)('JSON integration and serialization', function () {
        (0, bun_test_1.test)('seamless JSON integration', function () {
            var jsonData = {
                user: { name: 'Alice', preferences: { theme: 'dark' } },
                settings: { timeout: 5000 },
            };
            var store = (0, index_ts_1.createStore)(jsonData);
            (0, bun_test_1.expect)(store.user.name.get()).toBe('Alice');
            (0, bun_test_1.expect)(store.user.preferences.theme.get()).toBe('dark');
            (0, bun_test_1.expect)(store.settings.timeout.get()).toBe(5000);
            var serialized = JSON.stringify(store.get());
            var parsed = JSON.parse(serialized);
            (0, bun_test_1.expect)(parsed).toEqual(jsonData);
        });
        (0, bun_test_1.test)('handles complex nested structures from JSON', function () {
            var _a, _b;
            var complexData = {
                dashboard: {
                    widgets: [
                        { id: '1', type: 'chart', config: { color: 'blue' } },
                        { id: '2', type: 'table', config: { rows: 10 } },
                    ],
                },
            };
            var store = (0, index_ts_1.createStore)(complexData);
            (0, bun_test_1.expect)((_a = store.dashboard.widgets.at(0)) === null || _a === void 0 ? void 0 : _a.get().config.color).toBe('blue');
            (0, bun_test_1.expect)((_b = store.dashboard.widgets.at(1)) === null || _b === void 0 ? void 0 : _b.get().config.rows).toBe(10);
        });
    });
    (0, bun_test_1.describe)('type conversion and nested stores', function () {
        (0, bun_test_1.test)('nested objects become nested stores', function () {
            var config = (0, index_ts_1.createStore)({
                database: {
                    host: 'localhost',
                    port: 5432,
                },
            });
            (0, bun_test_1.expect)((0, index_ts_1.isStore)(config.database)).toBe(true);
            (0, bun_test_1.expect)(config.database.host.get()).toBe('localhost');
            (0, bun_test_1.expect)(config.database.port.get()).toBe(5432);
        });
    });
    (0, bun_test_1.describe)('Watch Callbacks', function () {
        (0, bun_test_1.test)('Root store watched callback triggered only by direct store access', function () { return __awaiter(void 0, void 0, void 0, function () {
            var rootStoreCounter, intervalId, store, nestedEffectCleanup, rootEffectCleanup;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rootStoreCounter = 0;
                        store = (0, index_ts_1.createStore)({
                            user: {
                                name: 'John',
                                profile: {
                                    email: 'john@example.com',
                                },
                            },
                        }, {
                            watched: function () {
                                intervalId = setInterval(function () {
                                    rootStoreCounter++;
                                }, 10);
                            },
                            unwatched: function () {
                                if (intervalId) {
                                    clearInterval(intervalId);
                                    intervalId = undefined;
                                }
                            },
                        });
                        (0, bun_test_1.expect)(rootStoreCounter).toBe(0);
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 1:
                        _a.sent();
                        (0, bun_test_1.expect)(rootStoreCounter).toBe(0);
                        nestedEffectCleanup = (0, index_ts_1.createEffect)(function () {
                            store.user.name.get();
                        });
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 2:
                        _a.sent();
                        (0, bun_test_1.expect)(rootStoreCounter).toBe(0); // Still 0 - nested access doesn't trigger root
                        (0, bun_test_1.expect)(intervalId).toBeUndefined();
                        rootEffectCleanup = (0, index_ts_1.createEffect)(function () {
                            store.get();
                        });
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 3:
                        _a.sent();
                        (0, bun_test_1.expect)(rootStoreCounter).toBeGreaterThan(0); // Now triggered
                        (0, bun_test_1.expect)(intervalId).toBeDefined();
                        // Cleanup
                        rootEffectCleanup();
                        nestedEffectCleanup();
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 4:
                        _a.sent();
                        (0, bun_test_1.expect)(intervalId).toBeUndefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('Store property addition/removal affects store watched callback', function () { return __awaiter(void 0, void 0, void 0, function () {
            var usersStoreCounter, store, usersEffect, userEffect;
            return __generator(this, function (_a) {
                usersStoreCounter = 0;
                store = (0, index_ts_1.createStore)({
                    users: {},
                }, {
                    watched: function () {
                        usersStoreCounter++;
                    },
                    unwatched: function () {
                        usersStoreCounter--;
                    },
                });
                (0, bun_test_1.expect)(usersStoreCounter).toBe(0);
                usersEffect = (0, index_ts_1.createEffect)(function () {
                    store.get();
                });
                (0, bun_test_1.expect)(usersStoreCounter).toBe(1);
                // Add a user - this modifies the users store content but doesn't affect watched callback
                store.users.add('user1', { name: 'Alice' });
                (0, bun_test_1.expect)(usersStoreCounter).toBe(1); // Still 1
                userEffect = (0, index_ts_1.createEffect)(function () {
                    var _a;
                    (_a = store.users.user1) === null || _a === void 0 ? void 0 : _a.name.get();
                });
                (0, bun_test_1.expect)(usersStoreCounter).toBe(1); // Still 1
                // Cleanup user effect
                userEffect();
                (0, bun_test_1.expect)(usersStoreCounter).toBe(1); // Still active due to usersEffect
                // Cleanup users effect
                usersEffect();
                (0, bun_test_1.expect)(usersStoreCounter).toBe(0); // Now cleaned up
                return [2 /*return*/];
            });
        }); });
    });
});
