import { describe, test, expect } from 'bun:test'
import { State, Computed, effect } from '../index';
import { makeGraph, runGraph, Counter } from "./util/dependency-graph";

/* === Utility Functions === */

const busy = () => {
	let a = 0;
	for (let i = 0; i < 1_00; i++) {
		a++;
	}
};

const framework = {
	name: "Cause & Effect",
	signal: <T>(initialValue: T) => {
		const s = State.of<T>(initialValue);
		return {
		write: (v: T) => s.set(v),
		read: () => s.get(),
		};
	},
	computed: <T>(fn: () => T) => {
		const c = Computed.of(fn, true);
		return { read: () => c.get() };
	},
	effect: (fn: () => void) => effect(fn),
	withBatch: fn => fn(),
	withBuild: fn => fn(),
};
const testPullCounts = true;

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
describe('Basic test', function () {
	const name = framework.name;

	test(`${name} | simple dependency executes`, () => {
		const s = framework.signal(2);
		const c = framework.computed(() => s.read()! * 2);

		expect(c.read()).toBe(4);
	});

	test(`${name} | static graph`, () => {
		const config = makeConfig();
		const { graph, counter } = makeGraph(framework, config);
		const sum = runGraph(graph, 2, 1, framework);

		expect(sum).toBe(16);
		if (testPullCounts) {
			expect(counter.count).toBe(11);
		}
	});

	test(`${name} | static graph, read 2/3 of leaves`, () => {
		const config = makeConfig();
		config.readFraction = 2 / 3;
		config.iterations = 10;
		const { counter, graph } = makeGraph(framework, config);
		const sum = runGraph(graph, 10, 2 / 3, framework);

		expect(sum).toBe(72);
		if (testPullCounts) {
			expect(counter.count).toBe(41);
		}
	});

	test(`${name} | dynamic graph`, () => {
		const config = makeConfig();
		config.staticFraction = 0.5;
		config.width = 4;
		config.totalLayers = 2;
		const { graph, counter } = makeGraph(framework, config);
		const sum = runGraph(graph, 10, 1, framework);

		expect(sum).toBe(72);
		if (testPullCounts) {
			expect(counter.count).toBe(22);
		}
	});
});

describe('Kairo tests', function () {
	const name = framework.name;

	test(`${name} | avoidable propagation`, () => {
		const head = framework.signal(0);
		const computed1 = framework.computed(() => head.read());
		const computed2 = framework.computed(() => (computed1.read(), 0));
		const computed3 = framework.computed(() => (busy(), computed2.read()! + 1)); // heavy computation
		const computed4 = framework.computed(() => computed3.read()! + 2);
		const computed5 = framework.computed(() => computed4.read()! + 3);
		framework.effect(() => {
			computed5.read();
			busy(); // heavy side effect
		});

		return () => {
			framework.withBatch(() => {
				head.write(1);
			});
			expect(computed5.read()).toBe(6);
			for (let i = 0; i < 10; i++) {
				framework.withBatch(() => {
					head.write(i);
				});
				expect(computed5.read()).toBe(6);
			}
		};
	});

	test(`${name} | broad propagation`, () => {
		const head = framework.signal(0);
		let last = head;
		const callCounter = new Counter();
		for (let i = 0; i < 50; i++) {
			let current = framework.computed(() => {
				return head.read()! + i;
			});
			let current2 = framework.computed(() => {
				return current.read()! + 1;
			});
			framework.effect(() => {
				current2.read();
				callCounter.count++;
			});
			last = current2;
		}

		return () => {
			framework.withBatch(() => {
				head.write(1);
			});
			const atleast = 50 * 50;
			callCounter.count = 0;
			for (let i = 0; i < 50; i++) {
				framework.withBatch(() => {
					head.write(i);
				});
				expect(last.read()).toBe(i + 50);
			}
			expect(callCounter.count).toBe(atleast);
		};
	});

	test(`${name} | deep propagation`, () => {
		let len = 50;
		const head = framework.signal(0);
		let current = head;
		for (let i = 0; i < len; i++) {
			let c = current;
			current = framework.computed(() => {
				return c.read() + 1;
			});
		}
		let callCounter = new Counter();
		framework.effect(() => {
			current.read();
			callCounter.count++;
		});
		const iter = 50;

		return () => {
			framework.withBatch(() => {
				head.write(1);
			});
			const atleast = iter;
			callCounter.count = 0;
			for (let i = 0; i < iter; i++) {
				framework.withBatch(() => {
					head.write(i);
				});
				expect(current.read()).toBe(len + i);
			}
			expect(callCounter.count).toBe(atleast);
		};
	});

	test(`${name} | diamond`, function () {
		let width = 5;
		const head = framework.signal(0);
		let current = [];
		for (let i = 0; i < width; i++) {
			current.push(
				framework.computed(() => head.read() + 1)
			);
		}
		let sum = framework.computed(() => {
			return current.map(x => x.read()).reduce((a, b) => a + b, 0);
		});
		let callCounter = new Counter();
		framework.effect(() => {
			sum.read();
			callCounter.count++;
		});

		return () => {
			framework.withBatch(() => {
				head.write(1);
			});
			expect(sum.read()).toBe(2 * width);
			const atleast = 500;
			callCounter.count = 0;
			for (let i = 0; i < 500; i++) {
				framework.withBatch(() => {
					head.write(i);
				});
				expect(sum.read()).toBe((i + 1) * width);
			}
			expect(callCounter.count).toBe(atleast);
		};
	});

	test(`${name} | mux`, function () {
		let heads = new Array(100).fill(null).map((_) => framework.signal(0));
		const mux = framework.computed(() => {
			return Object.fromEntries(heads.map((h) => h.read()).entries());
		});
		const splited = heads
			.map((_, index) => framework.computed(() => mux.read()[index]))
			.map((x) => framework.computed(() => x.read() + 1));

		splited.forEach((x) => {
			framework.effect(() => x.read());
		});

		return () => {
			for (let i = 0; i < 10; i++) {
				framework.withBatch(() => {
					heads[i].write(i);
				});
				expect(splited[i].read()).toBe(i + 1);
			}
			for (let i = 0; i < 10; i++) {
				framework.withBatch(() => {
					heads[i].write(i * 2);
				});
				expect(splited[i].read()).toBe(i * 2 + 1);
			}
		};
	});

	test(`${name} | repeated observers`, function () {
		const size = 30;
		let head = framework.signal(0);
		let current = framework.computed(() => {
			let result = 0;
			for (let i = 0; i < size; i++) {
				result += head.read();
			}
			return result;
		});
		let callCounter = new Counter();
		framework.effect(() => {
			current.read();
			callCounter.count++;
		});

		return () => {
			framework.withBatch(() => {
				head.write(1);
			});
			expect(current.read()).toBe(size);
			const atleast = 100;
			callCounter.count = 0;
			for (let i = 0; i < 100; i++) {
				framework.withBatch(() => {
					head.write(i);
				});
				expect(current.read()).toBe(i * size);
			}
			expect(callCounter.count).toBe(atleast);
		};
	});

	test(`${name} | triangle`, function () {
		let width = 10;
		let head = framework.signal(0);
		let current = head;
		let list = [];
		for (let i = 0; i < width; i++) {
			let c = current;
			list.push(current);
			current = framework.computed(() => {
				return c.read() + 1;
			});
		}
		let sum = framework.computed(() => {
			return list.map((x) => x.read()).reduce((a, b) => a + b, 0);
		});
		let callCounter = new Counter();
		framework.effect(() => {
			sum.read();
			callCounter.count++;
		});

		return () => {
			const constant = count(width);
			framework.withBatch(() => {
				head.write(1);
			});
			expect(sum.read()).toBe(constant);
			const atleast = 100;
			callCounter.count = 0;
			for (let i = 0; i < 100; i++) {
				framework.withBatch(() => {
					head.write(i);
				});
				expect(sum.read()).toBe(constant - width + i * width);
			}
			expect(callCounter.count).toBe(atleast);
		};
	});

	test(`${name} | unstable`, function () {
		let head = framework.signal(0);
		const double = framework.computed(() => head.read() * 2);
		const inverse = framework.computed(() => -head.read());
		let current = framework.computed(() => {
			let result = 0;
			for (let i = 0; i < 20; i++) {
				result += head.read() % 2 ? double.read() : inverse.read();
			}
			return result;
		});
		let callCounter = new Counter();
		framework.effect(() => {
			current.read();
			callCounter.count++;
		});

		return () => {
			framework.withBatch(() => {
				head.write(1);
			});
			expect(current.read()).toBe(40);
			const atleast = 100;
			callCounter.count = 0;
			for (let i = 0; i < 100; i++) {
				framework.withBatch(() => {
					head.write(i);
				});
				expect(current.read()).toBe(i % 2 ? i * 2 * 10 : i * -10);
			}
			expect(callCounter.count).toBe(atleast);
		};
	});
});

describe('$mol_wire tests', function () {
	const name = framework.name;

	test(`${name} | $mol_wire benchmark`, function() {
		const fib = (n) => {
			if (n < 2) return 1;
			return fib(n - 1) + fib(n - 2);
		};
		const hard = (n) => {
			return n + fib(16);
		};
		const numbers = Array.from({ length: 5 }, (_, i) => i);
		let res = [];
		const iter = framework.withBuild(() => {
			const A = framework.signal(0);
			const B = framework.signal(0);
			const C = framework.computed(() => (A.read() % 2) + (B.read() % 2));
			const D = framework.computed(() =>
				numbers.map((i) => ({ x: i + (A.read() % 2) - (B.read() % 2) }))
			);
			const E = framework.computed(() =>
				hard(C.read() + A.read() + D.read()[0].x, "E")
			);
			const F = framework.computed(() => hard(D.read()[2].x || B.read(), "F"));
			const G = framework.computed(
				() => C.read() + (C.read() || E.read() % 2) + D.read()[4].x + F.read()
			);
			framework.effect(() => res.push(hard(G.read(), "H")));
			framework.effect(() => res.push(G.read()), "I");
			framework.effect(() => res.push(hard(F.read(), "J")));
			framework.effect(() => res[0] = hard(G.read(), "H"));
			framework.effect(() => res[1] = G.read(), "I");
			framework.effect(() => res[2] = hard(F.read(), "J"));

			return (i) => {
				res.length = 0;
				framework.withBatch(() => {
					B.write(1);
					A.write(1 + i * 2);
				});
				framework.withBatch(() => {
					A.write(2 + i * 2);
					B.write(2);
				});
			};
		});

		expect(res.toString()).toBe([3201, 1604, 3196].toString());
	});
});

/* describe('CellX tests', function () {
const name = framework.name;

test(`${name} | CellX benchmark`, function() {
	const expected = {
	1000: [
		[-3, -6, -2, 2],
		[-2, -4, 2, 3],
	],
	2500: [
		[-3, -6, -2, 2],
		[-2, -4, 2, 3],
	],
	5000: [
		[2, 4, -1, -6],
		[-2, 1, -4, -4],
	]
	};
	const results = {};

	const cellx = (framework, layers) => {
	const start = {
		prop1: framework.signal(1),
		prop2: framework.signal(2),
		prop3: framework.signal(3),
		prop4: framework.signal(4),
	};
	let layer = start;

	for (let i = layers; i > 0; i--) {
		const m = layer;
		const s = {
		prop1: framework.computed(() => m.prop2.read()),
		prop2: framework.computed(() => m.prop1.read() - m.prop3.read()),
		prop3: framework.computed(() => m.prop2.read() + m.prop4.read()),
		prop4: framework.computed(() => m.prop3.read()),
		};

		framework.effect(() => s.prop1.read());
		framework.effect(() => s.prop2.read());
		framework.effect(() => s.prop3.read());
		framework.effect(() => s.prop4.read());

		s.prop1.read();
		s.prop2.read();
		s.prop3.read();
		s.prop4.read();

		layer = s;
	}

	const end = layer;

	const before = [
		end.prop1.read(),
		end.prop2.read(),
		end.prop3.read(),
		end.prop4.read(),
	];

	framework.withBatch(() => {
		start.prop1.write(4);
		start.prop2.write(3);
		start.prop3.write(2);
		start.prop4.write(1);
	});

	const after = [
		end.prop1.read(),
		end.prop2.read(),
		end.prop3.read(),
		end.prop4.read(),
	];

	return [before, after];
	};

	for (const layers in expected) {
	const [before, after] = cellx(framework, layers);
	const [expectedBefore, expectedAfter] = expected[layers];
	assert.equal(before.toString(), expectedBefore.toString(), `Expected first layer ${expectedBefore}, found first layer ${before}`);
	assert.equal(after.toString(), expectedAfter.toString(), `Expected first layer ${expectedAfter}, found first layer ${after}`);
	}
});
}); */
