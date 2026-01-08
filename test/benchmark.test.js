"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_ts_1 = require("../index.ts");
var dependency_graph_1 = require("./util/dependency-graph");
/* === Utility Functions === */
var busy = function () {
    var _a = 0;
    for (var i = 0; i < 100; i++) {
        _a++;
    }
};
var framework = {
    name: 'Cause & Effect',
    signal: function (initialValue) {
        var s = new index_ts_1.State(initialValue);
        return {
            write: function (v) { return s.set(v); },
            read: function () { return s.get(); },
        };
    },
    computed: function (fn) {
        var c = new index_ts_1.Memo(fn);
        return {
            read: function () { return c.get(); },
        };
    },
    effect: function (fn) { return (0, index_ts_1.createEffect)(fn); },
    withBatch: function (fn) { return (0, index_ts_1.batch)(fn); },
    withBuild: function (fn) { return fn(); },
};
var testPullCounts = true;
function makeConfig() {
    return {
        width: 3,
        totalLayers: 3,
        staticFraction: 1,
        nSources: 2,
        readFraction: 1,
        expected: {},
        iterations: 1,
    };
}
/* === Test functions === */
/** some basic tests to validate the reactive framework
 * wrapper works and can run performance tests.
 */
(0, bun_test_1.describe)('Basic test', function () {
    var name = framework.name;
    (0, bun_test_1.test)("".concat(name, " | simple dependency executes"), function () {
        framework.withBuild(function () {
            var s = framework.signal(2);
            var c = framework.computed(function () { return s.read() * 2; });
            (0, bun_test_1.expect)(c.read()).toEqual(4);
        });
    });
    (0, bun_test_1.test)("".concat(name, " | simple write"), function () {
        framework.withBuild(function () {
            var s = framework.signal(2);
            var c = framework.computed(function () { return s.read() * 2; });
            (0, bun_test_1.expect)(s.read()).toEqual(2);
            (0, bun_test_1.expect)(c.read()).toEqual(4);
            s.write(3);
            (0, bun_test_1.expect)(s.read()).toEqual(3);
            (0, bun_test_1.expect)(c.read()).toEqual(6);
        });
    });
    (0, bun_test_1.test)("".concat(name, " | static graph"), function () {
        var config = makeConfig();
        var counter = new dependency_graph_1.Counter();
        // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
        var graph = (0, dependency_graph_1.makeGraph)(framework, config, counter);
        // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
        var sum = (0, dependency_graph_1.runGraph)(graph, 2, 1, framework);
        (0, bun_test_1.expect)(sum).toEqual(16);
        if (testPullCounts) {
            (0, bun_test_1.expect)(counter.count).toEqual(11);
        }
        else {
            (0, bun_test_1.expect)(counter.count).toBeGreaterThanOrEqual(11);
        }
    });
    (0, bun_test_1.test)("".concat(name, " | static graph, read 2/3 of leaves"), function () {
        framework.withBuild(function () {
            var config = makeConfig();
            config.readFraction = 2 / 3;
            config.iterations = 10;
            var counter = new dependency_graph_1.Counter();
            // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
            var graph = (0, dependency_graph_1.makeGraph)(framework, config, counter);
            // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
            var sum = (0, dependency_graph_1.runGraph)(graph, 10, 2 / 3, framework);
            (0, bun_test_1.expect)(sum).toEqual(71);
            if (testPullCounts) {
                (0, bun_test_1.expect)(counter.count).toEqual(41);
            }
            else {
                (0, bun_test_1.expect)(counter.count).toBeGreaterThanOrEqual(41);
            }
        });
    });
    (0, bun_test_1.test)("".concat(name, " | dynamic graph"), function () {
        framework.withBuild(function () {
            var config = makeConfig();
            config.staticFraction = 0.5;
            config.width = 4;
            config.totalLayers = 2;
            var counter = new dependency_graph_1.Counter();
            // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
            var graph = (0, dependency_graph_1.makeGraph)(framework, config, counter);
            // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
            var sum = (0, dependency_graph_1.runGraph)(graph, 10, 1, framework);
            (0, bun_test_1.expect)(sum).toEqual(72);
            if (testPullCounts) {
                (0, bun_test_1.expect)(counter.count).toEqual(22);
            }
            else {
                (0, bun_test_1.expect)(counter.count).toBeGreaterThanOrEqual(22);
            }
        });
    });
    (0, bun_test_1.test)("".concat(name, " | withBuild"), function () {
        var r = framework.withBuild(function () {
            var s = framework.signal(2);
            var c = framework.computed(function () { return s.read() * 2; });
            (0, bun_test_1.expect)(c.read()).toEqual(4);
            return c.read();
        });
        (0, bun_test_1.expect)(r).toEqual(4);
    });
    (0, bun_test_1.test)("".concat(name, " | effect"), function () {
        var spy = function (_v) { };
        var spyMock = (0, bun_test_1.mock)(spy);
        var s = framework.signal(2);
        var c = { read: function () { return 0; } };
        framework.withBuild(function () {
            c = framework.computed(function () { return s.read() * 2; });
            framework.effect(function () {
                spyMock(c.read());
            });
        });
        (0, bun_test_1.expect)(spyMock.mock.calls.length).toBe(1);
        framework.withBatch(function () {
            s.write(3);
        });
        (0, bun_test_1.expect)(s.read()).toEqual(3);
        (0, bun_test_1.expect)(c.read()).toEqual(6);
        (0, bun_test_1.expect)(spyMock.mock.calls.length).toBe(2);
    });
});
(0, bun_test_1.describe)('Kairo tests', function () {
    var name = framework.name;
    (0, bun_test_1.test)("".concat(name, " | avoidable propagation"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var head, computed1, computed2, computed3, computed4, computed5;
        return __generator(this, function (_b) {
            head = framework.signal(0);
            computed1 = framework.computed(function () { return head.read(); });
            computed2 = framework.computed(function () {
                computed1.read();
                return 0;
            });
            computed3 = framework.computed(function () {
                busy();
                return computed2.read() + 1;
            }) // heavy computation
            ;
            computed4 = framework.computed(function () { return computed3.read() + 2; });
            computed5 = framework.computed(function () { return computed4.read() + 3; });
            framework.effect(function () {
                computed5.read();
                busy(); // heavy side effect
            });
            return [2 /*return*/, function () {
                    framework.withBatch(function () {
                        head.write(1);
                    });
                    (0, bun_test_1.expect)(computed5.read()).toBe(6);
                    var _loop_1 = function (i) {
                        framework.withBatch(function () {
                            head.write(i);
                        });
                        (0, bun_test_1.expect)(computed5.read()).toBe(6);
                    };
                    for (var i = 0; i < 10; i++) {
                        _loop_1(i);
                    }
                }];
        });
    }); });
    (0, bun_test_1.test)("".concat(name, " | broad propagation"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var head, last, callCounter, _loop_2, i;
        return __generator(this, function (_b) {
            head = framework.signal(0);
            last = head;
            callCounter = new dependency_graph_1.Counter();
            _loop_2 = function (i) {
                var current = framework.computed(function () {
                    return head.read() + i;
                });
                var current2 = framework.computed(function () {
                    return current.read() + 1;
                });
                framework.effect(function () {
                    current2.read();
                    callCounter.count++;
                });
                last = current2;
            };
            for (i = 0; i < 50; i++) {
                _loop_2(i);
            }
            return [2 /*return*/, function () {
                    framework.withBatch(function () {
                        head.write(1);
                    });
                    var atleast = 50 * 50;
                    callCounter.count = 0;
                    var _loop_3 = function (i) {
                        framework.withBatch(function () {
                            head.write(i);
                        });
                        (0, bun_test_1.expect)(last.read()).toBe(i + 50);
                    };
                    for (var i = 0; i < 50; i++) {
                        _loop_3(i);
                    }
                    (0, bun_test_1.expect)(callCounter.count).toBe(atleast);
                }];
        });
    }); });
    (0, bun_test_1.test)("".concat(name, " | deep propagation"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var len, head, current, _loop_4, i, callCounter, iter;
        return __generator(this, function (_b) {
            len = 50;
            head = framework.signal(0);
            current = head;
            _loop_4 = function (i) {
                var c = current;
                current = framework.computed(function () {
                    return c.read() + 1;
                });
            };
            for (i = 0; i < len; i++) {
                _loop_4(i);
            }
            callCounter = new dependency_graph_1.Counter();
            framework.effect(function () {
                current.read();
                callCounter.count++;
            });
            iter = 50;
            return [2 /*return*/, function () {
                    framework.withBatch(function () {
                        head.write(1);
                    });
                    var atleast = iter;
                    callCounter.count = 0;
                    var _loop_5 = function (i) {
                        framework.withBatch(function () {
                            head.write(i);
                        });
                        (0, bun_test_1.expect)(current.read()).toBe(len + i);
                    };
                    for (var i = 0; i < iter; i++) {
                        _loop_5(i);
                    }
                    (0, bun_test_1.expect)(callCounter.count).toBe(atleast);
                }];
        });
    }); });
    (0, bun_test_1.test)("".concat(name, " | diamond"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var width, head, current, i, sum, callCounter;
        return __generator(this, function (_b) {
            width = 5;
            head = framework.signal(0);
            current = [];
            for (i = 0; i < width; i++) {
                current.push(framework.computed(function () { return head.read() + 1; }));
            }
            sum = framework.computed(function () {
                return current.map(function (x) { return x.read(); }).reduce(function (a, b) { return a + b; }, 0);
            });
            callCounter = new dependency_graph_1.Counter();
            framework.effect(function () {
                sum.read();
                callCounter.count++;
            });
            return [2 /*return*/, function () {
                    framework.withBatch(function () {
                        head.write(1);
                    });
                    (0, bun_test_1.expect)(sum.read()).toBe(2 * width);
                    var atleast = 500;
                    callCounter.count = 0;
                    var _loop_6 = function (i) {
                        framework.withBatch(function () {
                            head.write(i);
                        });
                        (0, bun_test_1.expect)(sum.read()).toBe((i + 1) * width);
                    };
                    for (var i = 0; i < 500; i++) {
                        _loop_6(i);
                    }
                    (0, bun_test_1.expect)(callCounter.count).toBe(atleast);
                }];
        });
    }); });
    (0, bun_test_1.test)("".concat(name, " | mux"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var heads, mux, splited;
        return __generator(this, function (_b) {
            heads = new Array(100).fill(null).map(function (_) { return framework.signal(0); });
            mux = framework.computed(function () {
                return Object.fromEntries(heads.map(function (h) { return h.read(); }).entries());
            });
            splited = heads
                .map(function (_, index) { return framework.computed(function () { return mux.read()[index]; }); })
                .map(function (x) { return framework.computed(function () { return x.read() + 1; }); });
            splited.forEach(function (x) {
                framework.effect(function () {
                    x.read();
                });
            });
            return [2 /*return*/, function () {
                    var _loop_7 = function (i) {
                        framework.withBatch(function () {
                            heads[i].write(i);
                        });
                        (0, bun_test_1.expect)(splited[i].read()).toBe(i + 1);
                    };
                    for (var i = 0; i < 10; i++) {
                        _loop_7(i);
                    }
                    var _loop_8 = function (i) {
                        framework.withBatch(function () {
                            heads[i].write(i * 2);
                        });
                        (0, bun_test_1.expect)(splited[i].read()).toBe(i * 2 + 1);
                    };
                    for (var i = 0; i < 10; i++) {
                        _loop_8(i);
                    }
                }];
        });
    }); });
    (0, bun_test_1.test)("".concat(name, " | repeated observers"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var size, head, current, callCounter;
        return __generator(this, function (_b) {
            size = 30;
            head = framework.signal(0);
            current = framework.computed(function () {
                var result = 0;
                for (var i = 0; i < size; i++) {
                    result += head.read();
                }
                return result;
            });
            callCounter = new dependency_graph_1.Counter();
            framework.effect(function () {
                current.read();
                callCounter.count++;
            });
            return [2 /*return*/, function () {
                    framework.withBatch(function () {
                        head.write(1);
                    });
                    (0, bun_test_1.expect)(current.read()).toBe(size);
                    var atleast = 100;
                    callCounter.count = 0;
                    var _loop_9 = function (i) {
                        framework.withBatch(function () {
                            head.write(i);
                        });
                        (0, bun_test_1.expect)(current.read()).toBe(i * size);
                    };
                    for (var i = 0; i < 100; i++) {
                        _loop_9(i);
                    }
                    (0, bun_test_1.expect)(callCounter.count).toBe(atleast);
                }];
        });
    }); });
    (0, bun_test_1.test)("".concat(name, " | triangle"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var width, head, current, list, _loop_10, i, sum, callCounter;
        return __generator(this, function (_b) {
            width = 10;
            head = framework.signal(0);
            current = head;
            list = [];
            _loop_10 = function (i) {
                var c = current;
                list.push(current);
                current = framework.computed(function () {
                    return c.read() + 1;
                });
            };
            for (i = 0; i < width; i++) {
                _loop_10(i);
            }
            sum = framework.computed(function () {
                return list.map(function (x) { return x.read(); }).reduce(function (a, b) { return a + b; }, 0);
            });
            callCounter = new dependency_graph_1.Counter();
            framework.effect(function () {
                sum.read();
                callCounter.count++;
            });
            return [2 /*return*/, function () {
                    var count = function (number) {
                        return new Array(number)
                            .fill(0)
                            .map(function (_, i) { return i + 1; })
                            .reduce(function (x, y) { return x + y; }, 0);
                    };
                    var constant = count(width);
                    framework.withBatch(function () {
                        head.write(1);
                    });
                    (0, bun_test_1.expect)(sum.read()).toBe(constant);
                    var atleast = 100;
                    callCounter.count = 0;
                    var _loop_11 = function (i) {
                        framework.withBatch(function () {
                            head.write(i);
                        });
                        (0, bun_test_1.expect)(sum.read()).toBe(constant - width + i * width);
                    };
                    for (var i = 0; i < 100; i++) {
                        _loop_11(i);
                    }
                    (0, bun_test_1.expect)(callCounter.count).toBe(atleast);
                }];
        });
    }); });
    (0, bun_test_1.test)("".concat(name, " | unstable"), function () { return __awaiter(void 0, void 0, void 0, function () {
        var head, double, inverse, current, callCounter;
        return __generator(this, function (_b) {
            head = framework.signal(0);
            double = framework.computed(function () { return head.read() * 2; });
            inverse = framework.computed(function () { return -head.read(); });
            current = framework.computed(function () {
                var result = 0;
                for (var i = 0; i < 20; i++) {
                    result += head.read() % 2 ? double.read() : inverse.read();
                }
                return result;
            });
            callCounter = new dependency_graph_1.Counter();
            framework.effect(function () {
                current.read();
                callCounter.count++;
            });
            return [2 /*return*/, function () {
                    framework.withBatch(function () {
                        head.write(1);
                    });
                    (0, bun_test_1.expect)(current.read()).toBe(40);
                    var atleast = 100;
                    callCounter.count = 0;
                    var _loop_12 = function (i) {
                        framework.withBatch(function () {
                            head.write(i);
                        });
                        (0, bun_test_1.expect)(current.read()).toBe(i % 2 ? i * 2 * 10 : i * -10);
                    };
                    for (var i = 0; i < 100; i++) {
                        _loop_12(i);
                    }
                    (0, bun_test_1.expect)(callCounter.count).toBe(atleast);
                }];
        });
    }); });
});
(0, bun_test_1.describe)('$mol_wire tests', function () {
    var name = framework.name;
    (0, bun_test_1.test)("".concat(name, " | $mol_wire benchmark"), function () {
        // @ts-expect-error test
        var fib = function (n) {
            if (n < 2)
                return 1;
            return fib(n - 1) + fib(n - 2);
        };
        var hard = function (n, _log) {
            return n + fib(16);
        };
        var numbers = Array.from({ length: 5 }, function (_, i) { return i; });
        var res = [];
        framework.withBuild(function () {
            var A = framework.signal(0);
            var B = framework.signal(0);
            var C = framework.computed(function () { return (A.read() % 2) + (B.read() % 2); });
            var D = framework.computed(function () {
                return numbers.map(function (i) { return ({ x: i + (A.read() % 2) - (B.read() % 2) }); });
            });
            var E = framework.computed(function () {
                return hard(C.read() + A.read() + D.read()[0].x, 'E');
            });
            var F = framework.computed(function () {
                return hard(D.read()[2].x || B.read(), 'F');
            });
            var G = framework.computed(function () {
                return C.read() +
                    (C.read() || E.read() % 2) +
                    D.read()[4].x +
                    F.read();
            });
            framework.effect(function () {
                res.push(hard(G.read(), 'H'));
            });
            framework.effect(function () {
                res.push(G.read());
            }); // I
            framework.effect(function () {
                res.push(hard(F.read(), 'J'));
            });
            framework.effect(function () {
                res[0] = hard(G.read(), 'H');
            });
            framework.effect(function () {
                res[1] = G.read();
            }); // I
            framework.effect(function () {
                res[2] = hard(F.read(), 'J');
            });
            return function (i) {
                res.length = 0;
                framework.withBatch(function () {
                    B.write(1);
                    A.write(1 + i * 2);
                });
                framework.withBatch(function () {
                    A.write(2 + i * 2);
                    B.write(2);
                });
            };
        });
        (0, bun_test_1.expect)(res.toString()).toBe([3201, 1604, 3196].toString());
    });
});
(0, bun_test_1.describe)('CellX tests', function () {
    var name = framework.name;
    (0, bun_test_1.test)("".concat(name, " | CellX benchmark"), function () {
        var expected = {
            10: [
                [3, 6, 2, -2],
                [2, 4, -2, -3],
            ],
            20: [
                [2, 4, -1, -6],
                [-2, 1, -4, -4],
            ],
            50: [
                [-2, -4, 1, 6],
                [2, -1, 4, 4],
            ],
        };
        var cellx = function (framework, layers) {
            var start = {
                prop1: framework.signal(1),
                prop2: framework.signal(2),
                prop3: framework.signal(3),
                prop4: framework.signal(4),
            };
            var layer = start;
            var _loop_13 = function (i) {
                var m = layer;
                var s = {
                    prop1: framework.computed(function () { return m.prop2.read(); }),
                    prop2: framework.computed(function () { return m.prop1.read() - m.prop3.read(); }),
                    prop3: framework.computed(function () { return m.prop2.read() + m.prop4.read(); }),
                    prop4: framework.computed(function () { return m.prop3.read(); }),
                };
                framework.effect(function () {
                    s.prop1.read();
                });
                framework.effect(function () {
                    s.prop2.read();
                });
                framework.effect(function () {
                    s.prop3.read();
                });
                framework.effect(function () {
                    s.prop4.read();
                });
                framework.effect(function () {
                    s.prop1.read();
                });
                framework.effect(function () {
                    s.prop2.read();
                });
                framework.effect(function () {
                    s.prop3.read();
                });
                framework.effect(function () {
                    s.prop4.read();
                });
                s.prop1.read();
                s.prop2.read();
                s.prop3.read();
                s.prop4.read();
                layer = s;
            };
            for (var i = layers; i > 0; i--) {
                _loop_13(i);
            }
            var end = layer;
            var before = [
                end.prop1.read(),
                end.prop2.read(),
                end.prop3.read(),
                end.prop4.read(),
            ];
            framework.withBatch(function () {
                start.prop1.write(4);
                start.prop2.write(3);
                start.prop3.write(2);
                start.prop4.write(1);
            });
            var after = [
                end.prop1.read(),
                end.prop2.read(),
                end.prop3.read(),
                end.prop4.read(),
            ];
            return [before, after];
        };
        for (var layers in expected) {
            // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
            var _b = cellx(framework, layers), before = _b[0], after = _b[1];
            // @ts-expect-error - Framework object has incompatible type constraints with ReactiveFramework
            var _c = expected[layers], expectedBefore = _c[0], expectedAfter = _c[1];
            (0, bun_test_1.expect)(before.toString()).toBe(expectedBefore.toString());
            (0, bun_test_1.expect)(after.toString()).toBe(expectedAfter.toString());
        }
    });
});
