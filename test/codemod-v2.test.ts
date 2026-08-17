import { describe, expect, test } from 'bun:test'
import { migrateSource } from '../tools/codemod-v2.ts'

/* === Tests === */

describe('codemod-v2: exact-identifier renames', () => {
	test('renames types and guards, including their imports', () => {
		const { output } = migrateSource(
			"import { createList, isList, type Collection, type List } from '@zeix/cause-effect'\n" +
				'const items: List<string> = createList([])\n' +
				'const copy: Collection<string> = deriveList(() => [])\n' +
				'if (isList(items)) console.log(items.length)\n',
		)
		expect(output).toBe(
			"import { createList, isMutableList, type List, type MutableList, deriveList } from '@zeix/cause-effect'\n" +
				'const items: MutableList<string> = createList([])\n' +
				'const copy: List<string> = deriveList(() => [])\n' +
				'if (isMutableList(items)) console.log(items.length)\n',
		)
	})

	test('leaves longer names that merely contain the old ones', () => {
		const { output } = migrateSource(
			"import { type DeriveCollectionOptions, type ListOptions } from '@zeix/cause-effect'\n" +
				'const options: ListOptions<string> = {}\n' +
				'const deriveOptions: DeriveCollectionOptions<string> = {}\n',
		)
		expect(output).not.toContain('MutableListOptions')
		expect(output).not.toContain('DeriveListSourceOptions')
		expect(output).toContain('ListOptions<string>')
		expect(output).toContain('DeriveCollectionOptions<string>')
	})

	test('does not rename member names', () => {
		const { output } = migrateSource(
			'const shapes = { List: 1, Collection: 2 }\n' +
				'namespace CE { export type List<T> = unknown }\n',
			{ module: 'not-a-real-import' },
		)
		expect(output).toContain('{ List: 1, Collection: 2 }')
		expect(output).toContain('export type List<T> = unknown')
	})
})

describe('codemod-v2: readonly bridge renames', () => {
	test('renames DerivedList to List, isDerivedList to isList, DerivedStore to Store', () => {
		const { output } = migrateSource(
			"import { type DerivedList, type DerivedStore, isDerivedList } from '@zeix/cause-effect'\n" +
				'const rows: DerivedList<number> = deriveList(() => [])\n' +
				'const user: DerivedStore<{ name: string }> = deriveStore(() => ({ name: "Alice" }))\n' +
				'if (isDerivedList(rows)) console.log(rows.length)\n',
		)
		expect(output).toContain('const rows: List<number> = deriveList')
		expect(output).toContain(
			'const user: Store<{ name: string }> = deriveStore',
		)
		expect(output).toContain('if (isList(rows))')
		expect(output).not.toContain('DerivedList')
		expect(output).not.toContain('DerivedStore')
		expect(output).not.toContain('isDerivedList')
	})

	test('the readonly bridge renames are not flagged — no meaning-flip risk', () => {
		const { report } = migrateSource(
			"import { type DerivedList } from '@zeix/cause-effect'\n" +
				'const rows: DerivedList<number> = deriveList(() => [])\n',
		)
		expect(report.needsManualReview).toHaveLength(0)
	})
})

describe('codemod-v2: Store renames', () => {
	test('renames Store and isStore, including their imports', () => {
		const { output } = migrateSource(
			"import { createStore, isStore, type Store } from '@zeix/cause-effect'\n" +
				'const user: Store<{ name: string }> = createStore({ name: "Alice" })\n' +
				'if (isStore(user)) console.log(user.get())\n',
		)
		expect(output).toBe(
			"import { createStore, isMutableStore, type MutableStore } from '@zeix/cause-effect'\n" +
				'const user: MutableStore<{ name: string }> = createStore({ name: "Alice" })\n' +
				'if (isMutableStore(user)) console.log(user.get())\n',
		)
	})

	test('leaves longer names that merely contain Store', () => {
		const { output } = migrateSource(
			"import { type StoreOptions } from '@zeix/cause-effect'\n" +
				'const options: StoreOptions = {}\n',
		)
		expect(output).toContain('StoreOptions = {}')
		expect(output).not.toContain('MutableStoreOptions')
	})

	test('flags isStore renames for manual review', () => {
		const { report } = migrateSource(
			"import { isStore } from '@zeix/cause-effect'\n" +
				'const ok = isStore(value)\n',
		)
		expect(report.needsManualReview.join('\n')).toContain(
			'isMutableStore rejects a readonly Store',
		)
	})
})

describe('codemod-v2: Collection auxiliary type renames', () => {
	test('renames CollectionSource, CollectionCallback, CollectionChanges, and DeriveCollectionCallback, including their imports', () => {
		const { output } = migrateSource(
			'import {\n' +
				'  type CollectionSource,\n' +
				'  type CollectionCallback,\n' +
				'  type CollectionChanges,\n' +
				"  type DeriveCollectionCallback,\n} from '@zeix/cause-effect'\n" +
				'const source: CollectionSource<number> = createList([1])\n' +
				'const changes: CollectionChanges<number> = { add: [1] }\n' +
				'const watched: CollectionCallback<number> = apply => () => {}\n' +
				'const doubler: DeriveCollectionCallback<number, number> = n => n * 2\n',
		)
		expect(output).toContain('type ListSource')
		expect(output).toContain('type ListCallback')
		expect(output).toContain('type ListChanges')
		expect(output).toContain('type PerItemCallback')
		expect(output).toContain('const source: ListSource<number>')
		expect(output).toContain('const changes: ListChanges<number>')
		expect(output).toContain('const watched: ListCallback<number>')
		expect(output).toContain('const doubler: PerItemCallback<number, number>')
		expect(output).not.toContain('CollectionSource')
		expect(output).not.toContain('CollectionCallback')
		expect(output).not.toContain('CollectionChanges')
		expect(output).not.toContain('DeriveCollectionCallback')
	})

	test('these four renames are not flagged for manual review — no meaning-flip risk', () => {
		const { report } = migrateSource(
			"import { type CollectionSource } from '@zeix/cause-effect'\n" +
				'const source: CollectionSource<number> = createList([1])\n',
		)
		expect(
			report.needsManualReview.some(hint => hint.includes('ListSource')),
		).toBe(false)
	})

	test('leaves DeriveCollectionOptions alone — folded, not renamed', () => {
		const { output, report } = migrateSource(
			"import { type DeriveCollectionOptions } from '@zeix/cause-effect'\n" +
				'const options: DeriveCollectionOptions<number> = {}\n',
		)
		expect(output).toContain('DeriveCollectionOptions<number>')
		expect(report.renamed.DeriveCollectionOptions).toBeUndefined()
	})
})

describe('codemod-v2: single-value renames', () => {
	test('renames createMemo/createComputed to deriveComputed, createMutableSignal to createCell, deriveSignal to deriveCell', () => {
		const { output } = migrateSource(
			"import { createComputed, createMemo, createMutableSignal, deriveSignal } from '@zeix/cause-effect'\n" +
				'const doubled = createMemo(() => count.get() * 2)\n' +
				'const fallback = createComputed(() => count.get() * 2)\n' +
				'const name = createMutableSignal("Alice")\n' +
				'const user = deriveSignal(async () => fetchUser())\n',
		)
		expect(output).toContain(
			'const doubled = deriveComputed(() => count.get() * 2)',
		)
		expect(output).toContain(
			'const fallback = deriveComputed(() => count.get() * 2)',
		)
		expect(output).toContain('const name = createCell("Alice")')
		expect(output).toContain('const user = deriveCell(async () => fetchUser())')
		expect(output).toContain(
			"import { deriveComputed, createCell, deriveCell } from '@zeix/cause-effect'",
		)
		expect(output).not.toContain('createMemo')
		expect(output).not.toContain('createComputed')
		expect(output).not.toContain('createMutableSignal')
		expect(output).not.toContain('deriveSignal')
	})

	test('renames ComputedOptions/SensorOptions to DeriveSignalOptions and SensorCallback to SignalCallback', () => {
		const { output } = migrateSource(
			"import { type ComputedOptions, type SensorCallback, type SensorOptions } from '@zeix/cause-effect'\n" +
				'const opts: ComputedOptions<number> = {}\n' +
				'const watched: SensorCallback<number> = emit => () => {}\n' +
				'const sensorOpts: SensorOptions<number> = {}\n',
		)
		expect(output).toContain('DeriveSignalOptions<number>')
		expect(output).toContain('SignalCallback<number>')
		expect(output).not.toContain('ComputedOptions')
		expect(output).not.toContain('SensorOptions')
		expect(output).not.toContain('SensorCallback')
	})
})

describe('codemod-v2: createCollection rewrite', () => {
	test('callback only becomes an empty seed', () => {
		const { output, report } = migrateSource(
			"import { createCollection } from '@zeix/cause-effect'\n" +
				'const items = createCollection(apply => { setup(); return cleanup })\n',
		)
		expect(output).toContain(
			'deriveList([], { watched: apply => { setup(); return cleanup } })',
		)
		expect(output).toContain('deriveList')
		expect(output).not.toContain('createCollection')
		expect(report.createCollectionRewritten).toBe(1)
	})

	test('value option becomes the seed, others carry over', () => {
		const { output } = migrateSource(
			'const items = createCollection(apply => () => {}, { value: seed, keyConfig: item => item.id })\n',
		)
		expect(output).toContain(
			'deriveList(seed, { watched: apply => () => {}, keyConfig: item => item.id })',
		)
	})

	test('non-literal options are skipped and reported', () => {
		const { output, report } = migrateSource(
			'const items = createCollection(apply => () => {}, options)\n',
		)
		expect(output).toContain('createCollection')
		expect(report.createCollectionSkipped).toHaveLength(1)
	})

	test('a rewritten callback body still gets identifier renames', () => {
		const { output } = migrateSource(
			"import { createCollection, type List } from '@zeix/cause-effect'\n" +
				'const items = createCollection(apply => {\n' +
				'  const initial: List<string> = []\n' +
				'  return () => {}\n' +
				'})\n',
		)
		expect(output).toContain('const initial: MutableList<string> = []')
	})
})

describe('codemod-v2: flagged call sites', () => {
	test('leaves createSignal untouched and flags it', () => {
		const { output, report } = migrateSource(
			"import { createSignal } from '@zeix/cause-effect'\n" +
				'const count = createSignal(0)\n',
			{ module: 'not-a-real-import' },
		)
		expect(output).toContain('const count = createSignal(0)')
		expect(output).toContain(
			"import { createSignal } from '@zeix/cause-effect'",
		)
		expect(report.needsManualReview.join('\n')).toContain(
			'createSignal() has no single 2.0 rewrite',
		)
	})

	test('flags createTask and createSensor for manual deriveCell migration', () => {
		const { output, report } = migrateSource(
			"import { createSensor, createTask } from '@zeix/cause-effect'\n" +
				'const user = createTask(async () => fetchUser())\n' +
				'const clock = createSensor(emit => { setup(); return cleanup })\n',
			{ module: 'not-a-real-import' },
		)
		expect(output).toContain('const user = createTask(async () => fetchUser())')
		expect(output).toContain('const clock = createSensor(emit =>')
		expect(report.needsManualReview.join('\n')).toContain(
			'deriveCell(asyncFn, { initial })',
		)
		expect(report.needsManualReview.join('\n')).toContain(
			'deriveCell(seed, { watched })',
		)
	})

	test('flags origin guards without rewriting them', () => {
		const { output, report } = migrateSource(
			"import { isComputed, isState } from '@zeix/cause-effect'\n" +
				'if (isState(x)) read(x)\n' +
				'if (isComputed(y)) read(y)\n',
			{ module: 'not-a-real-import' },
		)
		expect(output).toContain('if (isState(x)) read(x)')
		expect(output).toContain('if (isComputed(y)) read(y)')
		expect(report.needsManualReview.join('\n')).toContain(
			'origin guards are removed in 2.0',
		)
		expect(report.needsManualReview.join('\n')).toContain('isMutableCell')
	})

	test('flags a still-used type MutableSignal import without rewriting it', () => {
		const { output, report } = migrateSource(
			"import { createMutableSignal, type MutableSignal } from '@zeix/cause-effect'\n" +
				'const s: MutableSignal<number> = createMutableSignal(1)\n',
		)
		expect(output).toContain('const s: MutableSignal<number> = createCell(1)')
		expect(report.needsManualReview.join('\n')).toContain(
			'type MutableSignal has no 2.0 export',
		)
	})

	test('does not flag a locally declared MutableSignal that was never imported', () => {
		const { output, report } = migrateSource(
			'type MutableSignal<T> = { set(value: T): void }\n' +
				'const s: MutableSignal<number> = { set(value) {} }\n',
			{ module: 'not-a-real-import' },
		)
		expect(output).toContain('type MutableSignal<T> = { set(value: T): void }')
		expect(report.needsManualReview.join('\n')).not.toContain('MutableSignal')
	})
})

describe('codemod-v2: report', () => {
	test('flags List renames for manual read-only review', () => {
		const { report } = migrateSource(
			"import { type List } from '@zeix/cause-effect'\n" +
				'const a: List<string> = createList([])\n',
		)
		expect(report.needsManualReview.join('\n')).toContain(
			'positions that only read can stay List<T>',
		)
	})

	test('leaves isSignal and isMutableSignal untouched and unflagged — the umbrella meaning survives', () => {
		const { output, report } = migrateSource(
			"import { isMutableSignal, isSignal } from '@zeix/cause-effect'\n" +
				'if (isSignal(x)) read(x)\n' +
				'if (isMutableSignal(y)) write(y)\n',
			{ module: 'not-a-real-import' },
		)
		expect(output).toBe(
			"import { isMutableSignal, isSignal } from '@zeix/cause-effect'\n" +
				'if (isSignal(x)) read(x)\n' +
				'if (isMutableSignal(y)) write(y)\n',
		)
		expect(report.needsManualReview).toHaveLength(0)
	})
})
