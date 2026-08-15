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
			"import { createList, isMutableList, type DerivedList, type MutableList, deriveList } from '@zeix/cause-effect'\n" +
				'const items: MutableList<string> = createList([])\n' +
				'const copy: DerivedList<string> = deriveList(() => [])\n' +
				'if (isMutableList(items)) console.log(items.length)\n',
		)
	})

	test('leaves longer names that merely contain the old ones', () => {
		const { output } = migrateSource(
			"import { type CollectionCallback, type ListOptions } from '@zeix/cause-effect'\n" +
				'const options: ListOptions<string> = {}\n' +
				'const watched: CollectionCallback<string> = () => () => {}\n',
		)
		expect(output).not.toContain('MutableListOptions')
		expect(output).not.toContain('DerivedListCallback')
		expect(output).toContain('ListOptions<string>')
		expect(output).toContain('CollectionCallback<string>')
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
			"import { type DerivedStore, type StoreOptions } from '@zeix/cause-effect'\n" +
				'const options: StoreOptions = {}\n' +
				'const derived: DerivedStore<{ a: number }> = deriveStore(() => ({ a: 1 }))\n',
		)
		expect(output).toContain('StoreOptions = {}')
		expect(output).toContain('DerivedStore<{ a: number }>')
		expect(output).not.toContain('MutableStoreOptions')
		expect(output).not.toContain('MutableDerivedStore')
	})

	test('flags isStore renames for manual review', () => {
		const { report } = migrateSource(
			"import { isStore } from '@zeix/cause-effect'\n" +
				'const ok = isStore(value)\n',
		)
		expect(report.needsManualReview.join('\n')).toContain(
			'isMutableStore rejects a DerivedStore',
		)
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

describe('codemod-v2: report', () => {
	test('flags List renames for manual read-only review', () => {
		const { report } = migrateSource(
			"import { type List } from '@zeix/cause-effect'\n" +
				'const a: List<string> = createList([])\n',
		)
		expect(report.needsManualReview.join('\n')).toContain('read-only positions')
	})
})
