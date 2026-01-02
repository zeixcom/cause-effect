import { List } from '../src/classes/list'
import {
	BaseStore,
	createStore as createClassStore,
} from '../src/classes/store'
import { createList as createFactoryList } from './list'
import { createStore as createFactoryStore } from './store'

/* === Benchmark Configuration === */

const ITERATIONS = 1000
const METHOD_CALLS = 100

/* === Test Data === */

const testData = {
	user: {
		id: 42,
		name: 'Alice Johnson',
		email: 'alice@example.com',
		preferences: {
			theme: 'dark' as const,
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
}

const testListData = [
	{ id: 1, name: 'Item 1', value: 10 },
	{ id: 2, name: 'Item 2', value: 20 },
	{ id: 3, name: 'Item 3', value: 30 },
	{ id: 4, name: 'Item 4', value: 40 },
	{ id: 5, name: 'Item 5', value: 50 },
]

/* === Benchmarking Utilities === */

const measureTime = (label: string, fn: () => void): number => {
	const start = performance.now()
	fn()
	const end = performance.now()
	const duration = end - start
	console.log(`${label}: ${duration.toFixed(2)}ms`)
	return duration
}

// biome-ignore lint/suspicious/noExplicitAny: test
const analyzeObjectStructure = (obj: any, label: string) => {
	const ownProps = Object.getOwnPropertyNames(obj)
	const ownMethods = ownProps.filter(prop => {
		const descriptor = Object.getOwnPropertyDescriptor(obj, prop)
		return descriptor && typeof descriptor.value === 'function'
	})
	const ownData = ownProps.filter(prop => {
		const descriptor = Object.getOwnPropertyDescriptor(obj, prop)
		return (
			descriptor &&
			(typeof descriptor.value !== 'function' ||
				descriptor.get ||
				descriptor.set)
		)
	})

	const prototype = Object.getPrototypeOf(obj)
	const prototypeProps = Object.getOwnPropertyNames(prototype)
	const prototypeMethods = prototypeProps.filter(prop => {
		if (prop === 'constructor') return false
		const descriptor = Object.getOwnPropertyDescriptor(prototype, prop)
		return descriptor && typeof descriptor.value === 'function'
	})

	console.log(`\n${label} Structure Analysis:`)
	console.log(
		`  Own Properties: ${ownProps.length} (${ownData.length} data, ${ownMethods.length} methods)`,
	)
	console.log(`  Prototype Methods: ${prototypeMethods.length}`)
	console.log(`  Own Methods: [${ownMethods.join(', ')}]`)
	console.log(
		`  Prototype Methods: [${prototypeMethods.slice(0, 5).join(', ')}${prototypeMethods.length > 5 ? '...' : ''}]`,
	)

	// Estimate more realistic memory usage
	let estimatedSize = 0
	estimatedSize += ownData.length * 32 // Property slots
	estimatedSize += ownMethods.length * 200 // Function objects (factories only)
	estimatedSize += prototypeMethods.length * 8 // Method references (shared)
	estimatedSize += 64 // Base object overhead

	return {
		ownMethods: ownMethods.length,
		prototypeMethods: prototypeMethods.length,
		ownData: ownData.length,
		estimatedSize,
	}
}

const measureMemory = async (
	label: string,
	// biome-ignore lint/suspicious/noExplicitAny: test
	fn: () => any[],
	// biome-ignore lint/suspicious/noExplicitAny: test
): Promise<any[]> => {
	// Force garbage collection multiple times to ensure clean baseline
	if ('gc' in globalThis && typeof globalThis.gc === 'function') {
		for (let i = 0; i < 3; i++) {
			globalThis.gc()
			await new Promise(resolve => setTimeout(resolve, 10))
		}
	}

	const memBefore = process.memoryUsage().heapUsed
	const result = fn()

	// Force another GC cycle and wait
	if ('gc' in globalThis && typeof globalThis.gc === 'function') {
		await new Promise(resolve => setTimeout(resolve, 50))
		globalThis.gc()
		await new Promise(resolve => setTimeout(resolve, 10))
	}

	const memAfter = process.memoryUsage().heapUsed
	const memDiff = memAfter - memBefore

	console.log(`${label} Memory: ${(memDiff / 1024 / 1024).toFixed(2)}MB`)
	return result
}

/* === Factory Approach Benchmark === */

const benchmarkFactory = async () => {
	console.log('\n=== Factory Function Approach ===')

	// biome-ignore lint/suspicious/noExplicitAny: test
	let stores: any[] = []

	// Test instantiation performance
	measureTime('Factory Instantiation', () => {
		stores = []
		for (let i = 0; i < ITERATIONS; i++) {
			stores.push(createFactoryStore({ ...testData, id: i }))
		}
	})

	// Test memory usage
	const memoryStores = await measureMemory('Factory Memory Usage', () => {
		const tempStores = []
		for (let i = 0; i < ITERATIONS; i++)
			// @ts-expect-error ignore
			tempStores.push(createFactoryStore({ ...testData, id: i }))
		return tempStores
	})

	// Analyze object structure
	const sampleFactoryStore = createFactoryStore(testData)
	const factoryAnalysis = analyzeObjectStructure(
		sampleFactoryStore,
		'Factory Store',
	)
	console.log(
		`Factory Estimated Size: ${(factoryAnalysis.estimatedSize / 1024).toFixed(2)}KB per store`,
	)
	console.log(
		`Factory Method Overhead: ${factoryAnalysis.ownMethods} own methods × ${ITERATIONS} stores = ${factoryAnalysis.ownMethods * ITERATIONS} method instances`,
	)

	// Test method call performance
	measureTime('Factory Method Calls', () => {
		for (let i = 0; i < METHOD_CALLS; i++) {
			memoryStores.forEach(store => {
				store.get()
				const _name = store.user.name
				const _emailNotification =
					store.user.preferences.notifications.email
				store.set({ ...testData, updated: true })
			})
		}
	})

	// Test method identity (should be different instances)
	const store1 = createFactoryStore(testData)
	const store2 = createFactoryStore(testData)
	console.log('Factory Methods Shared:', store1.get === store2.get) // Should be false

	return memoryStores
}

/* === Factory List Approach Benchmark === */

const benchmarkFactoryList = async () => {
	console.log('\n=== Factory List Function Approach ===')

	// biome-ignore lint/suspicious/noExplicitAny: test
	let lists: any[] = []

	// Test instantiation performance
	measureTime('Factory List Instantiation', () => {
		lists = []
		for (let i = 0; i < ITERATIONS; i++) {
			lists.push(
				createFactoryList([
					...testListData.map(item => ({
						...item,
						id: item.id + i * 1000,
					})),
				]),
			)
		}
	})

	// Test memory usage
	const memoryLists = await measureMemory('Factory List Memory Usage', () => {
		const tempLists = []
		for (let i = 0; i < ITERATIONS; i++) {
			tempLists.push(
				// @ts-expect-error ignore
				createFactoryList([
					...testListData.map(item => ({
						...item,
						id: item.id + i * 1000,
					})),
				]),
			)
		}
		return tempLists
	})

	// Analyze object structure
	const sampleFactoryList = createFactoryList(testListData)
	const factoryAnalysis = analyzeObjectStructure(
		sampleFactoryList,
		'Factory List',
	)
	console.log(
		`Factory List Estimated Size: ${(factoryAnalysis.estimatedSize / 1024).toFixed(2)}KB per list`,
	)
	console.log(
		`Factory List Method Overhead: ${factoryAnalysis.ownMethods} own methods × ${ITERATIONS} lists = ${factoryAnalysis.ownMethods * ITERATIONS} method instances`,
	)

	// Test method call performance
	measureTime('Factory List Method Calls', () => {
		for (let i = 0; i < METHOD_CALLS; i++) {
			memoryLists.forEach(list => {
				list.get()
				const _0 = list[0]
				const _length = list.length
				list.set([
					...testListData,
					{ id: 999, name: 'New', value: 999 },
				])
				list.sort()
			})
		}
	})

	// Test method identity (should be different instances)
	const list1 = createFactoryList(testListData)
	const list2 = createFactoryList(testListData)
	console.log('Factory List Methods Shared:', list1.get === list2.get) // Should be false

	return memoryLists
}

/* === Direct Class List Approach Benchmark (No Proxy) === */

const benchmarkDirectClassList = async () => {
	console.log('\n=== Direct Class-Based List Approach (No Proxy) ===')

	// biome-ignore lint/suspicious/noExplicitAny: test
	let lists: any[] = []

	// Test instantiation performance
	measureTime('Direct Class List Instantiation', () => {
		lists = []
		for (let i = 0; i < ITERATIONS; i++) {
			lists.push(
				new List([
					...testListData.map(item => ({
						...item,
						id: item.id + i * 1000,
					})),
				]),
			)
		}
	})

	// Test memory usage
	const memoryLists = await measureMemory(
		'Direct Class List Memory Usage',
		() => {
			const tempLists = []
			for (let i = 0; i < ITERATIONS; i++) {
				tempLists.push(
					// @ts-expect-error ignore
					new List([
						...testListData.map(item => ({
							...item,
							id: item.id + i * 1000,
						})),
					]),
				)
			}
			return tempLists
		},
	)

	// Analyze object structure
	const sampleDirectClassList = new List(testListData)
	const classAnalysis = analyzeObjectStructure(
		sampleDirectClassList,
		'Direct Class List',
	)
	console.log(
		`Direct Class List Estimated Size: ${(classAnalysis.estimatedSize / 1024).toFixed(2)}KB per list`,
	)
	console.log(
		`Direct Class List Method Overhead: ${classAnalysis.prototypeMethods} shared methods × ${ITERATIONS} lists = ${classAnalysis.prototypeMethods} method instances (shared)`,
	)

	// Test method call performance
	measureTime('Direct Class List Method Calls', () => {
		for (let i = 0; i < METHOD_CALLS; i++) {
			memoryLists.forEach(list => {
				list.get()
				const _0 = list.at(0)
				const _length = list.length
				list.set([
					...testListData,
					{ id: 999, name: 'New', value: 999 },
				])
				list.sort()
			})
		}
	})

	// Test method identity (should be same instances - shared prototype)
	const list1 = new List(testListData)
	const list2 = new List(testListData)
	console.log('Direct Class List Methods Shared:', list1.get === list2.get) // Should be true

	return memoryLists
}

/* === Class Approach Benchmark === */

const benchmarkClass = async () => {
	console.log('\n=== Class-Based Approach ===')

	// biome-ignore lint/suspicious/noExplicitAny: test
	let stores: any[] = []

	// Test instantiation performance
	measureTime('Class Instantiation', () => {
		stores = []
		for (let i = 0; i < ITERATIONS; i++) {
			stores.push(createClassStore({ ...testData, id: i }))
		}
	})

	// Test memory usage
	const memoryStores = await measureMemory('Class Memory Usage', () => {
		const tempStores = []
		for (let i = 0; i < ITERATIONS; i++)
			// @ts-expect-error ignore
			tempStores.push(createClassStore({ ...testData, id: i }))
		return tempStores
	})

	// Analyze object structure
	const sampleClassStore = createClassStore(testData)
	const classAnalysis = analyzeObjectStructure(
		sampleClassStore,
		'Class Store',
	)
	console.log(
		`Class Estimated Size: ${(classAnalysis.estimatedSize / 1024).toFixed(2)}KB per store`,
	)
	console.log(
		`Class Method Overhead: ${classAnalysis.prototypeMethods} shared methods × ${ITERATIONS} stores = ${classAnalysis.prototypeMethods} method instances (shared)`,
	)

	// Test method call performance
	measureTime('Class Method Calls', () => {
		for (let i = 0; i < METHOD_CALLS; i++) {
			memoryStores.forEach(store => {
				store.get()
				const _name = store.user.name
				const _emailNotification =
					store.user.preferences.notifications.email
				store.set({ ...testData, updated: true })
			})
		}
	})

	// Test method identity (should be same instances - shared prototype)
	const store1 = createClassStore(testData)
	const store2 = createClassStore(testData)
	console.log('Class Methods Shared:', store1.get === store2.get) // Should be true

	return memoryStores
}

/* === Direct Class Approach Benchmark (No Proxy) === */

const benchmarkDirectClass = async () => {
	console.log('\n=== Direct Class-Based Approach (No Proxy) ===')

	// biome-ignore lint/suspicious/noExplicitAny: test
	let stores: any[] = []

	// Test instantiation performance
	measureTime('Direct Class Instantiation', () => {
		stores = []
		for (let i = 0; i < ITERATIONS; i++) {
			stores.push(new BaseStore({ ...testData, id: i }))
		}
	})

	// Test memory usage
	const memoryStores = await measureMemory(
		'Direct Class Memory Usage',
		() => {
			const tempStores = []
			for (let i = 0; i < ITERATIONS; i++)
				// @ts-expect-error ignore
				tempStores.push(new BaseStore({ ...testData, id: i }))
			return tempStores
		},
	)

	// Analyze object structure
	const sampleDirectClassStore = new BaseStore(testData)
	const classAnalysis = analyzeObjectStructure(
		sampleDirectClassStore,
		'Direct Class Store',
	)
	console.log(
		`Direct Class Estimated Size: ${(classAnalysis.estimatedSize / 1024).toFixed(2)}KB per store`,
	)
	console.log(
		`Direct Class Method Overhead: ${classAnalysis.prototypeMethods} shared methods × ${ITERATIONS} stores = ${classAnalysis.prototypeMethods} method instances (shared)`,
	)

	// Test method call performance
	measureTime('Direct Class Method Calls', () => {
		for (let i = 0; i < METHOD_CALLS; i++) {
			memoryStores.forEach(store => {
				store.get()
				const _name = store.byKey('user').byKey('name')
				const _emailNotification = store
					.byKey('user')
					.byKey('preferences')
					.byKey('notifications')
					.byKey('email')
				store.set({ ...testData, updated: true })
			})
		}
	})

	// Test method identity (should be same instances - shared prototype)
	const store1 = new BaseStore(testData)
	const store2 = new BaseStore(testData)
	console.log('Direct Class Methods Shared:', store1.get === store2.get) // Should be true

	return memoryStores
}

/* === List Functionality Test === */

const testListFunctionality = () => {
	console.log('\n=== List Functionality Comparison ===')

	console.log('\n--- Factory List ---')
	const factoryList = createFactoryList([
		{ id: 1, name: 'A' },
		{ id: 2, name: 'B' },
	])
	console.log('Initial:', factoryList.get())
	console.log('Length:', factoryList.length)
	factoryList.add({ id: 3, name: 'C' })
	console.log('After add:', factoryList.get())
	console.log('Length:', factoryList.length)
	factoryList.splice(1, 1, { id: 4, name: 'D' })
	console.log('After splice:', factoryList.get())

	console.log('\n--- Class List ---')
	const classList = new List([
		{ id: 1, name: 'A' },
		{ id: 2, name: 'B' },
	])
	console.log('Initial:', classList.get())
	console.log('Length:', classList.length)
	classList.add({ id: 3, name: 'C' })
	console.log('After add:', classList.get())
	console.log('Length:', classList.length)
	classList.splice(1, 1, { id: 4, name: 'D' })
	console.log('After splice:', classList.get())

	// Test that both approaches produce equivalent results (after same operations)
	const factoryList2 = createFactoryList([{ id: 1, name: 'Test' }])
	const classList2 = new List([{ id: 1, name: 'Test' }])
	factoryList2.add({ id: 2, name: 'Test2' })
	classList2.add({ id: 2, name: 'Test2' })

	const factoryResult = JSON.stringify(factoryList2.get())
	const classResult = JSON.stringify(classList2.get())
	console.log(
		'\nList Functionally Equivalent:',
		factoryResult === classResult,
	)
}

/* === Store Functionality Test === */

const testStoreFunctionality = () => {
	console.log('\n=== Functionality Comparison ===')

	console.log('\n--- Factory Store ---')
	const factoryStore = createFactoryStore<{
		a: number
		b: number
		c?: number
	}>({ a: 1, b: 2 })
	console.log('Initial:', factoryStore.get())
	factoryStore.set({ a: 10, b: 20, c: 30 })
	console.log('After set:', factoryStore.get())
	console.log(
		'Keys:',
		Array.from(factoryStore).map(([key]) => key),
	)

	console.log('\n--- Class Store ---')
	const classStore = createClassStore<{
		a: number
		b: number
		c?: number
	}>({ a: 1, b: 2 })
	console.log('Initial:', classStore.get())
	classStore.set({ a: 10, b: 20, c: 30 })
	console.log('After set:', classStore.get())
	console.log(
		'Keys:',
		Array.from(classStore).map(([key]) => key),
	)

	// Test that both approaches produce equivalent results
	const factoryResult = JSON.stringify(factoryStore.get())
	const classResult = JSON.stringify(classStore.get())
	console.log(
		'\nStore Functionally Equivalent:',
		factoryResult === classResult,
	)
}

/* === Comparative Analysis === */

const runComparison = async () => {
	console.log(`\n${'='.repeat(60)}`)
	console.log('STORE & LIST IMPLEMENTATION BENCHMARK')
	console.log(`Iterations: ${ITERATIONS} | Method Calls: ${METHOD_CALLS}`)
	console.log(`${'='.repeat(60)}`)

	// Test functionality first
	testStoreFunctionality()
	testListFunctionality()

	// Run Store benchmarks
	console.log(`\n${'='.repeat(40)}`)
	console.log('STORE BENCHMARKS')
	console.log(`${'='.repeat(40)}`)
	const factoryStores = await benchmarkFactory()
	const classStores = await benchmarkClass()
	const directClassStores = await benchmarkDirectClass()

	// Run List benchmarks
	console.log(`\n${'='.repeat(40)}`)
	console.log('LIST BENCHMARKS')
	console.log(`${'='.repeat(40)}`)
	const factoryLists = await benchmarkFactoryList()
	const directClassLists = await benchmarkDirectClassList()

	// Detailed memory analysis for both Store and List
	const sampleFactory = createFactoryStore(testData)
	const sampleClass = createClassStore(testData)
	const sampleFactoryList = createFactoryList(testListData)
	const sampleClassList = new List(testListData)

	const factoryStoreAnalysis = analyzeObjectStructure(
		sampleFactory,
		'Final Factory Store Analysis',
	)
	const classStoreAnalysis = analyzeObjectStructure(
		sampleClass,
		'Final Class Store Analysis',
	)
	const factoryListAnalysis = analyzeObjectStructure(
		sampleFactoryList,
		'Final Factory List Analysis',
	)
	const classListAnalysis = analyzeObjectStructure(
		sampleClassList,
		'Final Class List Analysis',
	)

	console.log('\n=== Memory Analysis Summary ===')

	// Store Memory Analysis
	console.log('\n--- Store Memory Analysis ---')
	console.log(
		`Store Factory Method Duplication: ${factoryStoreAnalysis.ownMethods * ITERATIONS} function instances`,
	)
	console.log(
		`Store Class Method Sharing: ${classStoreAnalysis.prototypeMethods} shared function instances`,
	)

	const storeMethodMemorySaving =
		((factoryStoreAnalysis.ownMethods * ITERATIONS -
			classStoreAnalysis.prototypeMethods) *
			200) /
		1024 /
		1024
	console.log(
		`Store Estimated Method Memory Savings: ${storeMethodMemorySaving.toFixed(2)}MB`,
	)

	// List Memory Analysis
	console.log('\n--- List Memory Analysis ---')
	console.log(
		`List Factory Method Duplication: ${factoryListAnalysis.ownMethods * ITERATIONS} function instances`,
	)
	console.log(
		`List Class Method Sharing: ${classListAnalysis.prototypeMethods} shared function instances`,
	)

	const listMethodMemorySaving =
		((factoryListAnalysis.ownMethods * ITERATIONS -
			classListAnalysis.prototypeMethods) *
			200) /
		1024 /
		1024
	console.log(
		`List Estimated Method Memory Savings: ${listMethodMemorySaving.toFixed(2)}MB`,
	)

	const totalMethodMemorySaving =
		storeMethodMemorySaving + listMethodMemorySaving
	console.log(
		`Total Estimated Method Memory Savings: ${totalMethodMemorySaving.toFixed(2)}MB`,
	)

	console.log('\n=== Performance Comparison Summary ===')
	console.log('Direct Class (No Proxy) vs Proxy Class vs Factory approaches:')
	console.log('- Direct Class should have fastest method calls')
	console.log('- Proxy Class has convenience but method call overhead')
	console.log('- Factory has per-instance method overhead')

	// Keep references to prevent GC during measurement
	return {
		factoryStores,
		classStores,
		directClassStores,
		factoryLists,
		directClassLists,
	}
}

/* === Export === */

export { runComparison }

// Auto-run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runComparison().catch(console.error)
}
