import { describe, expect, test } from 'bun:test'
import {
	batch,
	createEffect,
	createList,
	createScope,
	createSlot,
	createState,
	deriveCell,
	deriveComputed,
	deriveList,
	match,
} from '../index.ts'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ─── Guide: Keyed Collections ────────────────────────────────────────────────

describe('Guide: Keyed Collections', () => {
	type Todo = { id: string; title: string; done: boolean }

	test('list with content-based keyConfig assigns item.id as key', () => {
		const todos = createList<Todo>(
			[
				{ id: 'a', title: 'Write docs', done: false },
				{ id: 'b', title: 'Ship release', done: true },
			],
			{ keyConfig: item => item.id },
		)
		expect(todos.keyAt(0)).toBe('a')
		expect(todos.keyAt(1)).toBe('b')
		expect(todos.byKey('a')?.get()).toEqual({
			id: 'a',
			title: 'Write docs',
			done: false,
		})
	})

	test('byKey returns the same signal reference before and after replace', () => {
		const todos = createList<Todo>(
			[{ id: 'a', title: 'Write docs', done: false }],
			{ keyConfig: item => item.id },
		)
		const before = todos.byKey('a')
		todos.replace('a', { id: 'a', title: 'Write final docs', done: false })
		expect(todos.byKey('a')).toBe(before)
		expect(todos.byKey('a')?.get().title).toBe('Write final docs')
	})

	test('replace notifies an effect reading the item signal directly', () => {
		const todos = createList<Todo>(
			[{ id: 'a', title: 'Write docs', done: false }],
			{ keyConfig: item => item.id },
		)
		const seen: string[] = []
		const itemSignal = todos.byKey('a')
		const dispose = createEffect(() => {
			// biome-ignore lint/style/noNonNullAssertion: just assigned before
			seen.push(itemSignal!.get().title)
		})
		todos.replace('a', { id: 'a', title: 'Write final docs', done: false })
		expect(seen).toEqual(['Write docs', 'Write final docs'])
		dispose()
	})

	test('deriveList maps item values to a read-only list', () => {
		const todos = createList<Todo>(
			[
				{ id: 'a', title: 'Write docs', done: false },
				{ id: 'b', title: 'Ship release', done: true },
			],
			{ keyConfig: item => item.id },
		)
		const visibleTitles = deriveList(todos, item =>
			item.done ? 'archived' : item.title,
		)
		expect(visibleTitles.get()).toEqual(['Write docs', 'archived'])
	})

	test('deriveList updates when an item is replaced', () => {
		const todos = createList<Todo>(
			[
				{ id: 'a', title: 'Write docs', done: false },
				{ id: 'b', title: 'Ship release', done: true },
			],
			{ keyConfig: item => item.id },
		)
		const visibleTitles = deriveList(todos, item =>
			item.done ? 'archived' : item.title,
		)
		todos.replace('b', { id: 'b', title: 'Ship release', done: false })
		expect(visibleTitles.get()).toEqual(['Write docs', 'Ship release'])
	})

	test('sort reorders items and derived collection follows', () => {
		const todos = createList<Todo>(
			[
				{ id: 'a', title: 'Write docs', done: false },
				{ id: 'b', title: 'Audit docs build', done: false },
				{ id: 'c', title: 'Ship release', done: false },
			],
			{ keyConfig: item => item.id },
		)
		const titles = deriveList(todos, item => item.title)
		todos.sort((a, b) => a.title.localeCompare(b.title))
		expect(todos.get().map(t => t.title)).toEqual([
			'Audit docs build',
			'Ship release',
			'Write docs',
		])
		expect(titles.get()).toEqual([
			'Audit docs build',
			'Ship release',
			'Write docs',
		])
	})

	test('add inserts a new item and increments length', () => {
		const todos = createList<Todo>(
			[{ id: 'a', title: 'Write docs', done: false }],
			{ keyConfig: item => item.id },
		)
		todos.add({ id: 'c', title: 'Audit docs build', done: false })
		expect(todos.length).toBe(2)
		expect(todos.byKey('c')?.get().title).toBe('Audit docs build')
	})

	test('openCount memo tracks undone items across mutations', () => {
		const todos = createList<Todo>(
			[
				{ id: 'a', title: 'Write docs', done: false },
				{ id: 'b', title: 'Ship release', done: true },
			],
			{ keyConfig: item => item.id },
		)
		const openCount = deriveComputed(
			() => todos.get().filter(item => !item.done).length,
		)
		expect(openCount.get()).toBe(1)
		todos.replace('b', { id: 'b', title: 'Ship release', done: false })
		expect(openCount.get()).toBe(2)
	})

	test('full guide: replace + add + sort produce correct order and derived values', () => {
		const todos = createList<Todo>(
			[
				{ id: 'a', title: 'Write docs', done: false },
				{ id: 'b', title: 'Ship release', done: true },
			],
			{ keyConfig: item => item.id },
		)
		const openCount = deriveComputed(
			() => todos.get().filter(item => !item.done).length,
		)
		const visibleTitles = deriveList(todos, item =>
			item.done ? 'archived' : item.title,
		)

		todos.replace('a', { id: 'a', title: 'Write final docs', done: false })
		todos.add({ id: 'c', title: 'Audit docs build', done: false })
		todos.sort((a, b) => a.title.localeCompare(b.title))

		// After sort: 'Audit docs build' < 'Ship release' < 'Write final docs'
		expect(todos.get().map(t => t.title)).toEqual([
			'Audit docs build',
			'Ship release',
			'Write final docs',
		])
		expect(openCount.get()).toBe(2) // 'Audit docs build' and 'Write final docs' are open
		expect(visibleTitles.get()).toEqual([
			'Audit docs build',
			'archived',
			'Write final docs',
		])
	})
})

// ─── Guide: Async Data Pipelines ─────────────────────────────────────────────

describe('Guide: Async Data Pipelines', () => {
	type SearchResponse = {
		items: { id: string; title: string }[]
		total: number
	}
	const SEED: SearchResponse = { items: [], total: 0 }

	test('task with seed value enters stale state on first match', async () => {
		const query = createState('books')
		const results = deriveCell<SearchResponse>(
			async (_prev, abort) => {
				await wait(50)
				if (abort.aborted) return SEED
				return { items: [{ id: '1', title: query.get() }], total: 1 }
			},
			{ initial: SEED },
		)
		const states: string[] = []
		const dispose = createEffect(() => {
			match(results, {
				stale: () => {
					states.push('stale')
				},
				ok: data => {
					states.push(`ok:${data.total}`)
				},
			})
		})
		expect(states).toEqual(['stale'])
		await wait(60)
		expect(states).toEqual(['stale', 'ok:1'])
		dispose()
	})

	test('derived memo reads seed value while task is pending', async () => {
		const results = deriveCell<SearchResponse>(
			async () => {
				await wait(50)
				return { items: [{ id: '1', title: 'test' }], total: 42 }
			},
			{ initial: SEED },
		)
		const totalPages = deriveComputed(() =>
			Math.max(1, Math.ceil(results.get().total / 20)),
		)
		results.get() // trigger computation
		expect(totalPages.get()).toBe(1) // seed total=0 → max(1, ceil(0/20))=1
		await wait(60)
		expect(totalPages.get()).toBe(3) // resolved total=42 → ceil(42/20)=3
	})

	test('batch prevents duplicate task run when query and page change together', async () => {
		const query = createState('books')
		const page = createState(1)
		const requestKey = deriveComputed(() => ({
			query: query.get().trim(),
			page: page.get(),
		}))
		let runCount = 0
		const results = deriveCell<SearchResponse>(
			async (_prev, abort) => {
				runCount++
				const { query: q, page: p } = requestKey.get()
				await wait(30)
				if (abort.aborted) return SEED
				return { items: [{ id: '1', title: `${q} p${p}` }], total: 1 }
			},
			{ initial: SEED },
		)
		const dispose = createEffect(() => {
			match(results, {
				stale: () => {},
				ok: () => {},
			})
		})
		await wait(50) // first run completes
		const firstRunCount = runCount

		batch(() => {
			query.set('signals')
			page.set(2) // changing both ensures a meaningful batch test
		})
		await wait(60) // second run completes
		expect(runCount).toBe(firstRunCount + 1) // exactly one additional run
		expect(results.get().items[0]?.title).toBe('signals p2')
		dispose()
	})

	test('AbortSignal is triggered when dependency changes before task completes', async () => {
		const query = createState('books')
		const aborted: string[] = []
		const results = deriveCell<SearchResponse>(
			async (_prev, signal) => {
				const q = query.get()
				await wait(80)
				if (signal.aborted) {
					aborted.push(q)
					return SEED
				}
				return { items: [{ id: '1', title: q }], total: 1 }
			},
			{ initial: SEED },
		)
		const dispose = createEffect(() => {
			match(results, {
				stale: () => {},
				ok: () => {},
			})
		})
		await wait(20) // first run ('books') is in flight
		query.set('signals') // aborts 'books' run, starts 'signals' run
		await wait(100) // 'signals' run completes 80ms after re-trigger
		expect(aborted).toContain('books')
		expect(results.get().items[0]?.title).toBe('signals')
		dispose()
	})
})

// ─── Guide: Custom Elements and External Lifecycles ──────────────────────────

describe('Guide: Custom Elements and External Lifecycles', () => {
	test('slot used as property descriptor reads from and writes to backing signal', () => {
		const source = createState('draft')
		const slot = createSlot(source)
		const target: Record<string, unknown> = {}
		Object.defineProperty(target, 'value', slot)

		expect((target as { value: string }).value).toBe('draft')
		;(target as { value: string }).value = 'published'
		expect(source.get()).toBe('published')
	})

	test('slot.replace swaps backing signal and downstream effects resubscribe', () => {
		const internalValue = createState('draft')
		const slot = createSlot(internalValue)
		const log: string[] = []
		const dispose = createEffect(() => {
			log.push(slot.get())
		})
		const controlled = deriveComputed(() => `status:${internalValue.get()}`)
		slot.replace(controlled)
		expect(log).toEqual(['draft', 'status:draft'])
		internalValue.set('published')
		expect(log).toEqual(['draft', 'status:draft', 'status:published'])
		dispose()
	})

	test('sensor watched callback starts lazily on first subscription and stops on dispose', () => {
		let started = false
		let stopped = false
		let push!: (v: boolean) => void
		const sensor = deriveCell<boolean>(false, {
			watched: set => {
				started = true
				push = set
				push(true)
				return () => {
					stopped = true
				}
			},
		})
		expect(started).toBe(false) // lazy — not started until first subscriber
		const log: boolean[] = []
		const dispose = createEffect(() => {
			log.push(sensor.get())
		})
		expect(started).toBe(true)
		expect(log).toEqual([true])
		push(false)
		expect(log).toEqual([true, false])
		expect(stopped).toBe(false)
		dispose()
		expect(stopped).toBe(true) // cleanup runs when last subscriber unsubscribes
	})

	test('simulated custom element: createScope root:true is sole lifecycle authority', () => {
		const label = createState('idle')
		const log: string[] = []

		class MockElement {
			#dispose?: (() => void) | undefined
			textContent = ''

			connectedCallback() {
				this.#dispose = createScope(
					() => {
						createEffect(() => {
							this.textContent = label.get()
							log.push(this.textContent)
						})
					},
					{ root: true },
				)
			}

			disconnectedCallback() {
				this.#dispose?.()
				this.#dispose = undefined
			}
		}

		const el = new MockElement()
		el.connectedCallback()
		expect(log).toEqual(['idle'])

		label.set('active')
		expect(log).toEqual(['idle', 'active'])

		el.disconnectedCallback()
		label.set('gone')
		expect(log).toEqual(['idle', 'active']) // scope disposed — no more updates

		el.connectedCallback() // reconnect: fresh scope picks up current label value
		expect(log).toEqual(['idle', 'active', 'gone'])

		el.disconnectedCallback()
	})
})
