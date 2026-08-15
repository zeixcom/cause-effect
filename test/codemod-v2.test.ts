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

	test('flags isSignal and isMutableSignal call sites without rewriting them', () => {
		const { output, report } = migrateSource(
			"import { isMutableSignal, isSignal } from '@zeix/cause-effect'\n" +
				'if (isSignal(x)) read(x)\n' +
				'if (isMutableSignal(y)) write(y)\n',
			{ module: 'not-a-real-import' },
		)
		expect(output).toContain('if (isSignal(x)) read(x)')
		expect(output).toContain('if (isMutableSignal(y)) write(y)')
		expect(report.needsManualReview.join('\n')).toContain(
			'2 isSignal()/isMutableSignal() call(s)',
		)
	})

	test('does not flag isSignal when absent', () => {
		const { report } = migrateSource('const a = 1\n', {
			module: 'not-a-real-import',
		})
		expect(report.needsManualReview.join('\n')).not.toContain('isSignal()')
	})
})
