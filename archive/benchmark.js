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
exports.runComparison = void 0;
var list_1 = require("../src/classes/list");
var store_1 = require("../src/classes/store");
var list_2 = require("./list");
var store_2 = require("./store");
/* === Benchmark Configuration === */
var ITERATIONS = 1000;
var METHOD_CALLS = 100;
/* === Test Data === */
var testData = {
    user: {
        id: 42,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        preferences: {
            theme: 'dark',
            language: 'en',
            notifications: {
                email: true,
                push: false,
                desktop: true,
            },
        },
    },
    app: {
        version: '2.1.0',
        config: {
            api: {
                baseUrl: 'https://api.example.com',
                timeout: 5000,
            },
        },
    },
};
var testListData = [
    { id: 1, name: 'Item 1', value: 10 },
    { id: 2, name: 'Item 2', value: 20 },
    { id: 3, name: 'Item 3', value: 30 },
    { id: 4, name: 'Item 4', value: 40 },
    { id: 5, name: 'Item 5', value: 50 },
];
/* === Benchmarking Utilities === */
var measureTime = function (label, fn) {
    var start = performance.now();
    fn();
    var end = performance.now();
    var duration = end - start;
    console.log("".concat(label, ": ").concat(duration.toFixed(2), "ms"));
    return duration;
};
// biome-ignore lint/suspicious/noExplicitAny: test
var analyzeObjectStructure = function (obj, label) {
    var ownProps = Object.getOwnPropertyNames(obj);
    var ownMethods = ownProps.filter(function (prop) {
        var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        return descriptor && typeof descriptor.value === 'function';
    });
    var ownData = ownProps.filter(function (prop) {
        var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        return (descriptor &&
            (typeof descriptor.value !== 'function' ||
                descriptor.get ||
                descriptor.set));
    });
    var prototype = Object.getPrototypeOf(obj);
    var prototypeProps = Object.getOwnPropertyNames(prototype);
    var prototypeMethods = prototypeProps.filter(function (prop) {
        if (prop === 'constructor')
            return false;
        var descriptor = Object.getOwnPropertyDescriptor(prototype, prop);
        return descriptor && typeof descriptor.value === 'function';
    });
    console.log("\n".concat(label, " Structure Analysis:"));
    console.log("  Own Properties: ".concat(ownProps.length, " (").concat(ownData.length, " data, ").concat(ownMethods.length, " methods)"));
    console.log("  Prototype Methods: ".concat(prototypeMethods.length));
    console.log("  Own Methods: [".concat(ownMethods.join(', '), "]"));
    console.log("  Prototype Methods: [".concat(prototypeMethods.slice(0, 5).join(', ')).concat(prototypeMethods.length > 5 ? '...' : '', "]"));
    // Estimate more realistic memory usage
    var estimatedSize = 0;
    estimatedSize += ownData.length * 32; // Property slots
    estimatedSize += ownMethods.length * 200; // Function objects (factories only)
    estimatedSize += prototypeMethods.length * 8; // Method references (shared)
    estimatedSize += 64; // Base object overhead
    return {
        ownMethods: ownMethods.length,
        prototypeMethods: prototypeMethods.length,
        ownData: ownData.length,
        estimatedSize: estimatedSize,
    };
};
var measureMemory = function (label, 
// biome-ignore lint/suspicious/noExplicitAny: test
fn) { return __awaiter(void 0, void 0, void 0, function () {
    var i, memBefore, result, memAfter, memDiff;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!('gc' in globalThis && typeof globalThis.gc === 'function')) return [3 /*break*/, 4];
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < 3)) return [3 /*break*/, 4];
                globalThis.gc();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                i++;
                return [3 /*break*/, 1];
            case 4:
                memBefore = process.memoryUsage().heapUsed;
                result = fn();
                if (!('gc' in globalThis && typeof globalThis.gc === 'function')) return [3 /*break*/, 7];
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
            case 5:
                _a.sent();
                globalThis.gc();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
            case 6:
                _a.sent();
                _a.label = 7;
            case 7:
                memAfter = process.memoryUsage().heapUsed;
                memDiff = memAfter - memBefore;
                console.log("".concat(label, " Memory: ").concat((memDiff / 1024 / 1024).toFixed(2), "MB"));
                return [2 /*return*/, result];
        }
    });
}); };
/* === Factory Approach Benchmark === */
var benchmarkFactory = function () { return __awaiter(void 0, void 0, void 0, function () {
    var stores, memoryStores, sampleFactoryStore, factoryAnalysis, store1, store2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\n=== Factory Function Approach ===');
                stores = [];
                // Test instantiation performance
                measureTime('Factory Instantiation', function () {
                    stores = [];
                    for (var i = 0; i < ITERATIONS; i++) {
                        stores.push((0, store_2.createStore)(__assign(__assign({}, testData), { id: i })));
                    }
                });
                return [4 /*yield*/, measureMemory('Factory Memory Usage', function () {
                        var tempStores = [];
                        for (var i = 0; i < ITERATIONS; i++)
                            tempStores.push((0, store_2.createStore)(__assign(__assign({}, testData), { id: i })));
                        return tempStores;
                    })
                    // Analyze object structure
                ];
            case 1:
                memoryStores = _a.sent();
                sampleFactoryStore = (0, store_2.createStore)(testData);
                factoryAnalysis = analyzeObjectStructure(sampleFactoryStore, 'Factory Store');
                console.log("Factory Estimated Size: ".concat((factoryAnalysis.estimatedSize / 1024).toFixed(2), "KB per store"));
                console.log("Factory Method Overhead: ".concat(factoryAnalysis.ownMethods, " own methods \u00D7 ").concat(ITERATIONS, " stores = ").concat(factoryAnalysis.ownMethods * ITERATIONS, " method instances"));
                // Test method call performance
                measureTime('Factory Method Calls', function () {
                    for (var i = 0; i < METHOD_CALLS; i++) {
                        memoryStores.forEach(function (store) {
                            store.get();
                            var _name = store.user.name;
                            var _emailNotification = store.user.preferences.notifications.email;
                            store.set(__assign(__assign({}, testData), { updated: true }));
                        });
                    }
                });
                store1 = (0, store_2.createStore)(testData);
                store2 = (0, store_2.createStore)(testData);
                console.log('Factory Methods Shared:', store1.get === store2.get); // Should be false
                return [2 /*return*/, memoryStores];
        }
    });
}); };
/* === Factory List Approach Benchmark === */
var benchmarkFactoryList = function () { return __awaiter(void 0, void 0, void 0, function () {
    var lists, memoryLists, sampleFactoryList, factoryAnalysis, list1, list2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\n=== Factory List Function Approach ===');
                lists = [];
                // Test instantiation performance
                measureTime('Factory List Instantiation', function () {
                    lists = [];
                    var _loop_1 = function (i) {
                        lists.push((0, list_2.createList)(__spreadArray([], testListData.map(function (item) { return (__assign(__assign({}, item), { id: item.id + i * 1000 })); }), true)));
                    };
                    for (var i = 0; i < ITERATIONS; i++) {
                        _loop_1(i);
                    }
                });
                return [4 /*yield*/, measureMemory('Factory List Memory Usage', function () {
                        var tempLists = [];
                        var _loop_2 = function (i) {
                            tempLists.push((0, list_2.createList)(__spreadArray([], testListData.map(function (item) { return (__assign(__assign({}, item), { id: item.id + i * 1000 })); }), true)));
                        };
                        for (var i = 0; i < ITERATIONS; i++) {
                            _loop_2(i);
                        }
                        return tempLists;
                    })
                    // Analyze object structure
                ];
            case 1:
                memoryLists = _a.sent();
                sampleFactoryList = (0, list_2.createList)(testListData);
                factoryAnalysis = analyzeObjectStructure(sampleFactoryList, 'Factory List');
                console.log("Factory List Estimated Size: ".concat((factoryAnalysis.estimatedSize / 1024).toFixed(2), "KB per list"));
                console.log("Factory List Method Overhead: ".concat(factoryAnalysis.ownMethods, " own methods \u00D7 ").concat(ITERATIONS, " lists = ").concat(factoryAnalysis.ownMethods * ITERATIONS, " method instances"));
                // Test method call performance
                measureTime('Factory List Method Calls', function () {
                    for (var i = 0; i < METHOD_CALLS; i++) {
                        memoryLists.forEach(function (list) {
                            list.get();
                            var _0 = list[0];
                            var _length = list.length;
                            list.set(__spreadArray(__spreadArray([], testListData, true), [
                                { id: 999, name: 'New', value: 999 },
                            ], false));
                            list.sort();
                        });
                    }
                });
                list1 = (0, list_2.createList)(testListData);
                list2 = (0, list_2.createList)(testListData);
                console.log('Factory List Methods Shared:', list1.get === list2.get); // Should be false
                return [2 /*return*/, memoryLists];
        }
    });
}); };
/* === Direct Class List Approach Benchmark (No Proxy) === */
var benchmarkDirectClassList = function () { return __awaiter(void 0, void 0, void 0, function () {
    var lists, memoryLists, sampleDirectClassList, classAnalysis, list1, list2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\n=== Direct Class-Based List Approach (No Proxy) ===');
                lists = [];
                // Test instantiation performance
                measureTime('Direct Class List Instantiation', function () {
                    lists = [];
                    var _loop_3 = function (i) {
                        lists.push(new list_1.List(__spreadArray([], testListData.map(function (item) { return (__assign(__assign({}, item), { id: item.id + i * 1000 })); }), true)));
                    };
                    for (var i = 0; i < ITERATIONS; i++) {
                        _loop_3(i);
                    }
                });
                return [4 /*yield*/, measureMemory('Direct Class List Memory Usage', function () {
                        var tempLists = [];
                        var _loop_4 = function (i) {
                            tempLists.push(new list_1.List(__spreadArray([], testListData.map(function (item) { return (__assign(__assign({}, item), { id: item.id + i * 1000 })); }), true)));
                        };
                        for (var i = 0; i < ITERATIONS; i++) {
                            _loop_4(i);
                        }
                        return tempLists;
                    })
                    // Analyze object structure
                ];
            case 1:
                memoryLists = _a.sent();
                sampleDirectClassList = new list_1.List(testListData);
                classAnalysis = analyzeObjectStructure(sampleDirectClassList, 'Direct Class List');
                console.log("Direct Class List Estimated Size: ".concat((classAnalysis.estimatedSize / 1024).toFixed(2), "KB per list"));
                console.log("Direct Class List Method Overhead: ".concat(classAnalysis.prototypeMethods, " shared methods \u00D7 ").concat(ITERATIONS, " lists = ").concat(classAnalysis.prototypeMethods, " method instances (shared)"));
                // Test method call performance
                measureTime('Direct Class List Method Calls', function () {
                    for (var i = 0; i < METHOD_CALLS; i++) {
                        memoryLists.forEach(function (list) {
                            list.get();
                            var _0 = list.at(0);
                            var _length = list.length;
                            list.set(__spreadArray(__spreadArray([], testListData, true), [
                                { id: 999, name: 'New', value: 999 },
                            ], false));
                            list.sort();
                        });
                    }
                });
                list1 = new list_1.List(testListData);
                list2 = new list_1.List(testListData);
                console.log('Direct Class List Methods Shared:', list1.get === list2.get); // Should be true
                return [2 /*return*/, memoryLists];
        }
    });
}); };
/* === Class Approach Benchmark === */
var benchmarkClass = function () { return __awaiter(void 0, void 0, void 0, function () {
    var stores, memoryStores, sampleClassStore, classAnalysis, store1, store2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\n=== Class-Based Approach ===');
                stores = [];
                // Test instantiation performance
                measureTime('Class Instantiation', function () {
                    stores = [];
                    for (var i = 0; i < ITERATIONS; i++) {
                        stores.push((0, store_1.createStore)(__assign(__assign({}, testData), { id: i })));
                    }
                });
                return [4 /*yield*/, measureMemory('Class Memory Usage', function () {
                        var tempStores = [];
                        for (var i = 0; i < ITERATIONS; i++)
                            tempStores.push((0, store_1.createStore)(__assign(__assign({}, testData), { id: i })));
                        return tempStores;
                    })
                    // Analyze object structure
                ];
            case 1:
                memoryStores = _a.sent();
                sampleClassStore = (0, store_1.createStore)(testData);
                classAnalysis = analyzeObjectStructure(sampleClassStore, 'Class Store');
                console.log("Class Estimated Size: ".concat((classAnalysis.estimatedSize / 1024).toFixed(2), "KB per store"));
                console.log("Class Method Overhead: ".concat(classAnalysis.prototypeMethods, " shared methods \u00D7 ").concat(ITERATIONS, " stores = ").concat(classAnalysis.prototypeMethods, " method instances (shared)"));
                // Test method call performance
                measureTime('Class Method Calls', function () {
                    for (var i = 0; i < METHOD_CALLS; i++) {
                        memoryStores.forEach(function (store) {
                            store.get();
                            var _name = store.user.name;
                            var _emailNotification = store.user.preferences.notifications.email;
                            store.set(__assign(__assign({}, testData), { updated: true }));
                        });
                    }
                });
                store1 = (0, store_1.createStore)(testData);
                store2 = (0, store_1.createStore)(testData);
                console.log('Class Methods Shared:', store1.get === store2.get); // Should be true
                return [2 /*return*/, memoryStores];
        }
    });
}); };
/* === Direct Class Approach Benchmark (No Proxy) === */
var benchmarkDirectClass = function () { return __awaiter(void 0, void 0, void 0, function () {
    var stores, memoryStores, sampleDirectClassStore, classAnalysis, store1, store2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('\n=== Direct Class-Based Approach (No Proxy) ===');
                stores = [];
                // Test instantiation performance
                measureTime('Direct Class Instantiation', function () {
                    stores = [];
                    for (var i = 0; i < ITERATIONS; i++) {
                        stores.push(new store_1.BaseStore(__assign(__assign({}, testData), { id: i })));
                    }
                });
                return [4 /*yield*/, measureMemory('Direct Class Memory Usage', function () {
                        var tempStores = [];
                        for (var i = 0; i < ITERATIONS; i++)
                            tempStores.push(new store_1.BaseStore(__assign(__assign({}, testData), { id: i })));
                        return tempStores;
                    })
                    // Analyze object structure
                ];
            case 1:
                memoryStores = _a.sent();
                sampleDirectClassStore = new store_1.BaseStore(testData);
                classAnalysis = analyzeObjectStructure(sampleDirectClassStore, 'Direct Class Store');
                console.log("Direct Class Estimated Size: ".concat((classAnalysis.estimatedSize / 1024).toFixed(2), "KB per store"));
                console.log("Direct Class Method Overhead: ".concat(classAnalysis.prototypeMethods, " shared methods \u00D7 ").concat(ITERATIONS, " stores = ").concat(classAnalysis.prototypeMethods, " method instances (shared)"));
                // Test method call performance
                measureTime('Direct Class Method Calls', function () {
                    for (var i = 0; i < METHOD_CALLS; i++) {
                        memoryStores.forEach(function (store) {
                            store.get();
                            var _name = store.byKey('user').byKey('name');
                            var _emailNotification = store
                                .byKey('user')
                                .byKey('preferences')
                                .byKey('notifications')
                                .byKey('email');
                            store.set(__assign(__assign({}, testData), { updated: true }));
                        });
                    }
                });
                store1 = new store_1.BaseStore(testData);
                store2 = new store_1.BaseStore(testData);
                console.log('Direct Class Methods Shared:', store1.get === store2.get); // Should be true
                return [2 /*return*/, memoryStores];
        }
    });
}); };
/* === List Functionality Test === */
var testListFunctionality = function () {
    console.log('\n=== List Functionality Comparison ===');
    console.log('\n--- Factory List ---');
    var factoryList = (0, list_2.createList)([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
    ]);
    console.log('Initial:', factoryList.get());
    console.log('Length:', factoryList.length);
    factoryList.add({ id: 3, name: 'C' });
    console.log('After add:', factoryList.get());
    console.log('Length:', factoryList.length);
    factoryList.splice(1, 1, { id: 4, name: 'D' });
    console.log('After splice:', factoryList.get());
    console.log('\n--- Class List ---');
    var classList = new list_1.List([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
    ]);
    console.log('Initial:', classList.get());
    console.log('Length:', classList.length);
    classList.add({ id: 3, name: 'C' });
    console.log('After add:', classList.get());
    console.log('Length:', classList.length);
    classList.splice(1, 1, { id: 4, name: 'D' });
    console.log('After splice:', classList.get());
    // Test that both approaches produce equivalent results (after same operations)
    var factoryList2 = (0, list_2.createList)([{ id: 1, name: 'Test' }]);
    var classList2 = new list_1.List([{ id: 1, name: 'Test' }]);
    factoryList2.add({ id: 2, name: 'Test2' });
    classList2.add({ id: 2, name: 'Test2' });
    var factoryResult = JSON.stringify(factoryList2.get());
    var classResult = JSON.stringify(classList2.get());
    console.log('\nList Functionally Equivalent:', factoryResult === classResult);
};
/* === Store Functionality Test === */
var testStoreFunctionality = function () {
    console.log('\n=== Functionality Comparison ===');
    console.log('\n--- Factory Store ---');
    var factoryStore = (0, store_2.createStore)({ a: 1, b: 2 });
    console.log('Initial:', factoryStore.get());
    factoryStore.set({ a: 10, b: 20, c: 30 });
    console.log('After set:', factoryStore.get());
    console.log('Keys:', Array.from(factoryStore).map(function (_a) {
        var key = _a[0];
        return key;
    }));
    console.log('\n--- Class Store ---');
    var classStore = (0, store_1.createStore)({ a: 1, b: 2 });
    console.log('Initial:', classStore.get());
    classStore.set({ a: 10, b: 20, c: 30 });
    console.log('After set:', classStore.get());
    console.log('Keys:', Array.from(classStore).map(function (_a) {
        var key = _a[0];
        return key;
    }));
    // Test that both approaches produce equivalent results
    var factoryResult = JSON.stringify(factoryStore.get());
    var classResult = JSON.stringify(classStore.get());
    console.log('\nStore Functionally Equivalent:', factoryResult === classResult);
};
/* === Comparative Analysis === */
var runComparison = function () { return __awaiter(void 0, void 0, void 0, function () {
    var factoryStores, classStores, directClassStores, factoryLists, directClassLists, sampleFactory, sampleClass, sampleFactoryList, sampleClassList, factoryStoreAnalysis, classStoreAnalysis, factoryListAnalysis, classListAnalysis, storeMethodMemorySaving, listMethodMemorySaving, totalMethodMemorySaving;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("\n".concat('='.repeat(60)));
                console.log('STORE & LIST IMPLEMENTATION BENCHMARK');
                console.log("Iterations: ".concat(ITERATIONS, " | Method Calls: ").concat(METHOD_CALLS));
                console.log("".concat('='.repeat(60)));
                // Test functionality first
                testStoreFunctionality();
                testListFunctionality();
                // Run Store benchmarks
                console.log("\n".concat('='.repeat(40)));
                console.log('STORE BENCHMARKS');
                console.log("".concat('='.repeat(40)));
                return [4 /*yield*/, benchmarkFactory()];
            case 1:
                factoryStores = _a.sent();
                return [4 /*yield*/, benchmarkClass()];
            case 2:
                classStores = _a.sent();
                return [4 /*yield*/, benchmarkDirectClass()
                    // Run List benchmarks
                ];
            case 3:
                directClassStores = _a.sent();
                // Run List benchmarks
                console.log("\n".concat('='.repeat(40)));
                console.log('LIST BENCHMARKS');
                console.log("".concat('='.repeat(40)));
                return [4 /*yield*/, benchmarkFactoryList()];
            case 4:
                factoryLists = _a.sent();
                return [4 /*yield*/, benchmarkDirectClassList()
                    // Detailed memory analysis for both Store and List
                ];
            case 5:
                directClassLists = _a.sent();
                sampleFactory = (0, store_2.createStore)(testData);
                sampleClass = (0, store_1.createStore)(testData);
                sampleFactoryList = (0, list_2.createList)(testListData);
                sampleClassList = new list_1.List(testListData);
                factoryStoreAnalysis = analyzeObjectStructure(sampleFactory, 'Final Factory Store Analysis');
                classStoreAnalysis = analyzeObjectStructure(sampleClass, 'Final Class Store Analysis');
                factoryListAnalysis = analyzeObjectStructure(sampleFactoryList, 'Final Factory List Analysis');
                classListAnalysis = analyzeObjectStructure(sampleClassList, 'Final Class List Analysis');
                console.log('\n=== Memory Analysis Summary ===');
                // Store Memory Analysis
                console.log('\n--- Store Memory Analysis ---');
                console.log("Store Factory Method Duplication: ".concat(factoryStoreAnalysis.ownMethods * ITERATIONS, " function instances"));
                console.log("Store Class Method Sharing: ".concat(classStoreAnalysis.prototypeMethods, " shared function instances"));
                storeMethodMemorySaving = ((factoryStoreAnalysis.ownMethods * ITERATIONS -
                    classStoreAnalysis.prototypeMethods) *
                    200) /
                    1024 /
                    1024;
                console.log("Store Estimated Method Memory Savings: ".concat(storeMethodMemorySaving.toFixed(2), "MB"));
                // List Memory Analysis
                console.log('\n--- List Memory Analysis ---');
                console.log("List Factory Method Duplication: ".concat(factoryListAnalysis.ownMethods * ITERATIONS, " function instances"));
                console.log("List Class Method Sharing: ".concat(classListAnalysis.prototypeMethods, " shared function instances"));
                listMethodMemorySaving = ((factoryListAnalysis.ownMethods * ITERATIONS -
                    classListAnalysis.prototypeMethods) *
                    200) /
                    1024 /
                    1024;
                console.log("List Estimated Method Memory Savings: ".concat(listMethodMemorySaving.toFixed(2), "MB"));
                totalMethodMemorySaving = storeMethodMemorySaving + listMethodMemorySaving;
                console.log("Total Estimated Method Memory Savings: ".concat(totalMethodMemorySaving.toFixed(2), "MB"));
                console.log('\n=== Performance Comparison Summary ===');
                console.log('Direct Class (No Proxy) vs Proxy Class vs Factory approaches:');
                console.log('- Direct Class should have fastest method calls');
                console.log('- Proxy Class has convenience but method call overhead');
                console.log('- Factory has per-instance method overhead');
                // Keep references to prevent GC during measurement
                return [2 /*return*/, {
                        factoryStores: factoryStores,
                        classStores: classStores,
                        directClassStores: directClassStores,
                        factoryLists: factoryLists,
                        directClassLists: directClassLists,
                    }];
        }
    });
}); };
exports.runComparison = runComparison;
// Auto-run if this file is executed directly
if (import.meta.url === "file://".concat(process.argv[1])) {
    runComparison().catch(console.error);
}
