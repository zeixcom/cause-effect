import { bench, group, run } from 'mitata'
import {
	batch,
	createEffect,
	createStore as createStoreV17,
	DerivedCollection,
	List,
	Memo,
	Ref,
	State,
	Task,
} from '../index.ts'
import {
	batch as batchNext,
	createCollection,
	createEffect as createEffectNext,
	createList,
	createMemo,
	createRef,
	createSensor,
	createState,
	createStore,
	createTask,
} from '../next.ts'
import type { ReactiveFramework } from '../test/util/reactive-framework'

/* === Framework Adapters === */

const v17: ReactiveFramework = {
	name: 'v0.17.3 (classes)',
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	signal: <T extends {}>(initialValue: T) => {
		const s = new State<T>(initialValue)
		return {
			write: (v: T) => s.set(v),
			read: () => s.get(),
		}
	},
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	computed: <T extends {}>(fn: () => T) => {
		const c = new Memo(fn)
		return { read: () => c.get() }
	},
	effect: (fn: () => undefined) => createEffect(fn),
	withBatch: fn => batch(fn),
	withBuild: <T>(fn: () => T) => fn(),
}

const v18: ReactiveFramework = {
	name: 'v0.18.0 (graph)',
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	signal: <T extends {}>(initialValue: T) => {
		const s = createState(initialValue)
		return { write: s.set, read: s.get }
	},
	// @ts-expect-error ReactiveFramework doesn't have non-nullable signals
	computed: <T extends {}>(fn: () => T) => {
		const c = createMemo(fn)
		return { read: c.get }
	},
	effect: (fn: () => undefined) => {
		createEffectNext(() => fn())
	},
	withBatch: fn => batchNext(fn),
	withBuild: <T>(fn: () => T) => fn(),
}

/* === Kairo Benchmarks === */

function setupDeep(fw: ReactiveFramework) {
	const len = 50
	const head = fw.signal(0)
	let current = head as { read: () => number }
	for (let i = 0; i < len; i++) {
		const c = current
		current = fw.computed(() => c.read() + 1)
	}
	fw.effect(() => {
		current.read()
	})
	let i = 0
	return () => {
		fw.withBatch(() => {
			head.write(++i)
		})
	}
}

function setupBroad(fw: ReactiveFramework) {
	const head = fw.signal(0)
	for (let i = 0; i < 50; i++) {
		const current = fw.computed(() => head.read() + i)
		const current2 = fw.computed(() => current.read() + 1)
		fw.effect(() => {
			current2.read()
		})
	}
	let i = 0
	return () => {
		fw.withBatch(() => {
			head.write(++i)
		})
	}
}

function setupDiamond(fw: ReactiveFramework) {
	const width = 5
	const head = fw.signal(0)
	const branches: { read(): number }[] = []
	for (let i = 0; i < width; i++) {
		branches.push(fw.computed(() => head.read() + 1))
	}
	const sum = fw.computed(() =>
		branches.map(x => x.read()).reduce((a, b) => a + b, 0),
	)
	fw.effect(() => {
		sum.read()
	})
	let i = 0
	return () => {
		fw.withBatch(() => {
			head.write(++i)
		})
	}
}

function setupTriangle(fw: ReactiveFramework) {
	const width = 10
	const head = fw.signal(0)
	let current = head as { read: () => number }
	const list: { read: () => number }[] = []
	for (let i = 0; i < width; i++) {
		const c = current
		list.push(current)
		current = fw.computed(() => c.read() + 1)
	}
	const sum = fw.computed(() =>
		list.map(x => x.read()).reduce((a, b) => a + b, 0),
	)
	fw.effect(() => {
		sum.read()
	})
	let i = 0
	return () => {
		fw.withBatch(() => {
			head.write(++i)
		})
	}
}

function setupMux(fw: ReactiveFramework) {
	const heads = new Array(100).fill(null).map(_ => fw.signal(0))
	const mux = fw.computed(() =>
		Object.fromEntries(heads.map(h => h.read()).entries()),
	)
	const splited = heads
		.map((_, index) => fw.computed(() => mux.read()[index]))
		.map(x => fw.computed(() => x.read() + 1))
	for (const x of splited) {
		fw.effect(() => {
			x.read()
		})
	}
	let i = 0
	return () => {
		const idx = i % heads.length
		fw.withBatch(() => {
			heads[idx].write(++i)
		})
	}
}

function setupUnstable(fw: ReactiveFramework) {
	const head = fw.signal(0)
	const double = fw.computed(() => head.read() * 2)
	const inverse = fw.computed(() => -head.read())
	const current = fw.computed(() => {
		let result = 0
		for (let i = 0; i < 20; i++) {
			result += head.read() % 2 ? double.read() : inverse.read()
		}
		return result
	})
	fw.effect(() => {
		current.read()
	})
	let i = 0
	return () => {
		fw.withBatch(() => {
			head.write(++i)
		})
	}
}

function setupAvoidable(fw: ReactiveFramework) {
	const head = fw.signal(0)
	const computed1 = fw.computed(() => head.read())
	const computed2 = fw.computed(() => {
		computed1.read()
		return 0
	})
	const computed3 = fw.computed(() => computed2.read() + 1)
	const computed4 = fw.computed(() => computed3.read() + 2)
	const computed5 = fw.computed(() => computed4.read() + 3)
	fw.effect(() => {
		computed5.read()
	})
	let i = 0
	return () => {
		fw.withBatch(() => {
			head.write(++i)
		})
	}
}

function setupRepeatedObservers(fw: ReactiveFramework) {
	const size = 30
	const head = fw.signal(0)
	const current = fw.computed(() => {
		let result = 0
		for (let i = 0; i < size; i++) {
			result += head.read()
		}
		return result
	})
	fw.effect(() => {
		current.read()
	})
	let i = 0
	return () => {
		fw.withBatch(() => {
			head.write(++i)
		})
	}
}

/* === CellX Benchmark === */

function setupCellx(fw: ReactiveFramework, layers: number) {
	const start = {
		prop1: fw.signal(1),
		prop2: fw.signal(2),
		prop3: fw.signal(3),
		prop4: fw.signal(4),
	}
	let layer: Record<string, { read(): number }> = start

	for (let i = layers; i > 0; i--) {
		const m = layer
		const s = {
			prop1: fw.computed(() => m.prop2.read()),
			prop2: fw.computed(() => m.prop1.read() - m.prop3.read()),
			prop3: fw.computed(() => m.prop2.read() + m.prop4.read()),
			prop4: fw.computed(() => m.prop3.read()),
		}

		fw.effect(() => {
			s.prop1.read()
		})
		fw.effect(() => {
			s.prop2.read()
		})
		fw.effect(() => {
			s.prop3.read()
		})
		fw.effect(() => {
			s.prop4.read()
		})
		fw.effect(() => {
			s.prop1.read()
		})
		fw.effect(() => {
			s.prop2.read()
		})
		fw.effect(() => {
			s.prop3.read()
		})
		fw.effect(() => {
			s.prop4.read()
		})

		layer = s
	}

	const end = layer
	let toggle = false
	return () => {
		toggle = !toggle
		fw.withBatch(() => {
			start.prop1.write(toggle ? 4 : 1)
			start.prop2.write(toggle ? 3 : 2)
			start.prop3.write(toggle ? 2 : 3)
			start.prop4.write(toggle ? 1 : 4)
		})
		end.prop1.read()
		end.prop2.read()
		end.prop3.read()
		end.prop4.read()
	}
}

/* === $mol_wire Benchmark === */

function setupMolWire(fw: ReactiveFramework) {
	const fib = (n: number): number => {
		if (n < 2) return 1
		return fib(n - 1) + fib(n - 2)
	}
	const hard = (n: number, _log: string) => n + fib(16)
	const numbers = Array.from({ length: 5 }, (_, i) => i)

	const A = fw.signal(0)
	const B = fw.signal(0)
	const C = fw.computed(() => (A.read() % 2) + (B.read() % 2))
	const D = fw.computed(() =>
		numbers.map(i => ({ x: i + (A.read() % 2) - (B.read() % 2) })),
	)
	const E = fw.computed(() => hard(C.read() + A.read() + D.read()[0].x, 'E'))
	const F = fw.computed(() => hard(D.read()[2].x || B.read(), 'F'))
	const G = fw.computed(
		() => C.read() + (C.read() || E.read() % 2) + D.read()[4].x + F.read(),
	)
	fw.effect(() => {
		hard(G.read(), 'H')
	})
	fw.effect(() => {
		G.read()
	})
	fw.effect(() => {
		hard(F.read(), 'J')
	})

	let i = 0
	return () => {
		i++
		fw.withBatch(() => {
			B.write(1)
			A.write(1 + i * 2)
		})
		fw.withBatch(() => {
			A.write(2 + i * 2)
			B.write(2)
		})
	}
}

/* === Signal Creation Benchmark === */

function benchCreateSignals(fw: ReactiveFramework, count: number) {
	return () => {
		for (let i = 0; i < count; i++) {
			fw.signal(i)
		}
	}
}

function benchCreateComputations(fw: ReactiveFramework, count: number) {
	const src = fw.signal(0)
	return () => {
		for (let i = 0; i < count; i++) {
			fw.computed(() => src.read())
		}
	}
}

/* === Run Benchmarks === */

// Kairo benchmarks
const kairoBenchmarks = [
	['deep propagation', setupDeep],
	['broad propagation', setupBroad],
	['diamond', setupDiamond],
	['triangle', setupTriangle],
	['mux', setupMux],
	['unstable', setupUnstable],
	['avoidable propagation', setupAvoidable],
	['repeated observers', setupRepeatedObservers],
] as const

for (const [name, setup] of kairoBenchmarks) {
	group(`Kairo: ${name}`, () => {
		const runV17 = setup(v17 as ReactiveFramework)
		const runV18 = setup(v18 as ReactiveFramework)
		bench('v0.17.3', runV17)
		bench('v0.18.0', runV18)
	})
}

// CellX benchmarks
for (const layers of [10]) {
	group(`CellX ${layers} layers`, () => {
		const runV17 = setupCellx(v17 as ReactiveFramework, layers)
		const runV18 = setupCellx(v18 as ReactiveFramework, layers)
		bench('v0.17.3', runV17)
		bench('v0.18.0', runV18)
	})
}

// $mol_wire benchmark
group('$mol_wire', () => {
	const runV17 = setupMolWire(v17 as ReactiveFramework)
	const runV18 = setupMolWire(v18 as ReactiveFramework)
	bench('v0.17.3', runV17)
	bench('v0.18.0', runV18)
})

// Creation benchmarks
group('Create 1k signals', () => {
	bench('v0.17.3', benchCreateSignals(v17 as ReactiveFramework, 1_000))
	bench('v0.18.0', benchCreateSignals(v18 as ReactiveFramework, 1_000))
})

group('Create 1k computations', () => {
	bench('v0.17.3', benchCreateComputations(v17 as ReactiveFramework, 1_000))
	bench('v0.18.0', benchCreateComputations(v18 as ReactiveFramework, 1_000))
})

/* === Task Benchmarks === */

group('Create 100 tasks', () => {
	bench('v0.17.3', () => {
		const src = new State(0)
		for (let i = 0; i < 100; i++) {
			new Task(async () => src.get() + 1)
		}
	})
	bench('v0.18.0', () => {
		const src = createState(0)
		for (let i = 0; i < 100; i++) {
			createTask(async () => src.get() + 1)
		}
	})
})

group('Task: resolve propagation', () => {
	const wait = () => new Promise<void>(r => setTimeout(r, 0))

	// v0.17.3: create task that resolves and triggers effect
	const srcV17 = new State(1)
	const taskV17 = new Task(async () => srcV17.get() * 2, {
		initialValue: 0,
	})
	createEffect(() => {
		taskV17.get()
	})

	// v0.18.0: same pattern
	const srcV18 = createState(1)
	const taskV18 = createTask(async () => srcV18.get() * 2, {
		value: 0,
	})
	createEffectNext(() => {
		taskV18.get()
	})

	let i17 = 1
	bench('v0.17.3', async () => {
		batch(() => srcV17.set(++i17))
		await wait()
	})
	let i18 = 1
	bench('v0.18.0', async () => {
		batchNext(() => srcV18.set(++i18))
		await wait()
	})
})

/* === Ref Benchmarks === */

group('Ref: create + notify', () => {
	bench('v0.17.3', () => {
		const obj = { x: 0 }
		const ref = new Ref(obj)
		createEffect(() => {
			ref.get()
		})
		for (let i = 0; i < 10; i++) {
			obj.x = i
			ref.notify()
		}
	})
	bench('v0.18.0', () => {
		const obj = { x: 0 }
		let notifyFn: () => void
		const ref = createRef(obj, notify => {
			notifyFn = notify
			return () => {}
		})
		createEffectNext(() => {
			ref.get()
		})
		for (let i = 0; i < 10; i++) {
			obj.x = i
			// biome-ignore lint/style/noNonNullAssertion: assigned in start callback
			notifyFn!()
		}
	})
})

/* === Sensor Benchmark (v0.18.0 only) === */

group('Sensor: create + update', () => {
	bench('v0.18.0', () => {
		let setFn: (v: number) => void
		const sensor = createSensor<number>(set => {
			setFn = set
			set(0) // Set initial value so .get() doesn't throw
			return () => {}
		})
		createEffectNext(() => {
			sensor.get()
		})
		for (let i = 0; i < 10; i++) {
			// biome-ignore lint/style/noNonNullAssertion: assigned in start callback
			setFn!(i)
		}
	})
})

/* === List Benchmarks === */

group('List: create 100 items', () => {
	const items = Array.from({ length: 100 }, (_, i) => i + 1)
	bench('v0.17.3', () => {
		new List(items)
	})
	bench('v0.18.0', () => {
		createList(items)
	})
})

group('List: add + remove 10 items', () => {
	bench('v0.17.3', () => {
		const list = new List<number>([1, 2, 3])
		for (let i = 0; i < 10; i++) list.add(i + 10)
		for (let i = 0; i < 10; i++) list.remove(0)
	})
	bench('v0.18.0', () => {
		const list = createList<number>([1, 2, 3])
		for (let i = 0; i < 10; i++) list.add(i + 10)
		for (let i = 0; i < 10; i++) list.remove(0)
	})
})

group('List: sort 50 items', () => {
	bench('v0.17.3', () => {
		const list = new List(
			Array.from({ length: 50 }, () => Math.random() * 100),
		)
		list.sort((a, b) => a - b)
	})
	bench('v0.18.0', () => {
		const list = createList(
			Array.from({ length: 50 }, () => Math.random() * 100),
		)
		list.sort((a, b) => a - b)
	})
})

group('List: set (diff) 50 items', () => {
	const initial = Array.from({ length: 50 }, (_, i) => i)
	const updated = Array.from({ length: 50 }, (_, i) => i * 2)
	bench('v0.17.3', () => {
		const list = new List(initial.slice())
		list.set(updated)
	})
	bench('v0.18.0', () => {
		const list = createList(initial.slice())
		list.set(updated)
	})
})

group('List: reactive propagation', () => {
	// v0.17.3: update existing item instead of growing the list
	const listV17 = new List([1, 2, 3])
	const memoV17 = new Memo(() => listV17.get().reduce((a, b) => a + b, 0))
	createEffect(() => {
		memoV17.get()
	})

	// v0.18.0
	const listV18 = createList([1, 2, 3])
	const memoV18 = createMemo(() => listV18.get().reduce((a, b) => a + b, 0))
	createEffectNext(() => {
		memoV18.get()
	})

	let i17 = 0
	bench('v0.17.3', () => {
		listV17.set([++i17, 2, 3])
	})
	let i18 = 0
	bench('v0.18.0', () => {
		listV18.set([++i18, 2, 3])
	})
})

/* === Collection Benchmarks === */

group('Collection: derive 50 items (sync)', () => {
	bench('v0.17.3', () => {
		const list = new List(Array.from({ length: 50 }, (_, i) => i + 1))
		const col = new DerivedCollection(list, (v: number) => v * 2)
		col.get()
	})
	bench('v0.18.0', () => {
		const list = createList(Array.from({ length: 50 }, (_, i) => i + 1))
		const col = createCollection(list, (v: number) => v * 2)
		col.get()
	})
})

group('Collection: chain 2 derivations', () => {
	bench('v0.17.3', () => {
		const list = new List(Array.from({ length: 20 }, (_, i) => i + 1))
		const col1 = list.deriveCollection((v: number) => v * 2)
		const col2 = col1.deriveCollection((v: number) => v + 1)
		col2.get()
	})
	bench('v0.18.0', () => {
		const list = createList(Array.from({ length: 20 }, (_, i) => i + 1))
		const col1 = list.deriveCollection((v: number) => v * 2)
		const col2 = col1.deriveCollection((v: number) => v + 1)
		col2.get()
	})
})

group('Collection: reactive update', () => {
	// v0.17.3: update existing items instead of growing the list
	const listV17 = new List([1, 2, 3, 4, 5])
	const colV17 = new DerivedCollection(listV17, (v: number) => v * 10)
	createEffect(() => {
		colV17.get()
	})

	// v0.18.0
	const listV18 = createList([1, 2, 3, 4, 5])
	const colV18 = createCollection(listV18, (v: number) => v * 10)
	createEffectNext(() => {
		colV18.get()
	})

	let i17 = 0
	bench('v0.17.3', () => {
		listV17.set([++i17, 2, 3, 4, 5])
	})
	let i18 = 0
	bench('v0.18.0', () => {
		listV18.set([++i18, 2, 3, 4, 5])
	})
})

/* === Store Benchmarks === */

group('Store: create with 10 properties', () => {
	const obj = Object.fromEntries(
		Array.from({ length: 10 }, (_, i) => [`key${i}`, i]),
	)
	bench('v0.17.3', () => {
		createStoreV17(obj)
	})
	bench('v0.18.0', () => {
		createStore(obj)
	})
})

group('Store: property access + set', () => {
	// v0.17.3
	const storeV17 = createStoreV17({ a: 1, b: 2, c: 3 })
	createEffect(() => {
		storeV17.a.get()
	})

	// v0.18.0
	const storeV18 = createStore({ a: 1, b: 2, c: 3 })
	createEffectNext(() => {
		storeV18.a.get()
	})

	let i17 = 1
	bench('v0.17.3', () => {
		storeV17.a.set(++i17)
	})
	let i18 = 1
	bench('v0.18.0', () => {
		storeV18.a.set(++i18)
	})
})

group('Store: set (diff) entire object', () => {
	// v0.17.3
	const storeV17 = createStoreV17({ x: 0, y: 0, z: 0 })
	createEffect(() => {
		storeV17.get()
	})

	// v0.18.0
	const storeV18 = createStore({ x: 0, y: 0, z: 0 })
	createEffectNext(() => {
		storeV18.get()
	})

	let i17 = 0
	bench('v0.17.3', () => {
		storeV17.set({ x: ++i17, y: i17 * 2, z: i17 * 3 })
	})
	let i18 = 0
	bench('v0.18.0', () => {
		storeV18.set({ x: ++i18, y: i18 * 2, z: i18 * 3 })
	})
})

group('Store: nested store propagation', () => {
	// v0.17.3
	const nestedV17 = createStoreV17({
		user: { name: 'Alice', prefs: { theme: 'light' } },
	})
	createEffect(() => {
		nestedV17.get()
	})

	// v0.18.0
	const nestedV18 = createStore({
		user: { name: 'Alice', prefs: { theme: 'light' } },
	})
	createEffectNext(() => {
		nestedV18.get()
	})

	let toggle17 = false
	bench('v0.17.3', () => {
		toggle17 = !toggle17
		nestedV17.user.prefs.theme.set(toggle17 ? 'dark' : 'light')
	})
	let toggle18 = false
	bench('v0.18.0', () => {
		toggle18 = !toggle18
		nestedV18.user.prefs.theme.set(toggle18 ? 'dark' : 'light')
	})
})

await run()
