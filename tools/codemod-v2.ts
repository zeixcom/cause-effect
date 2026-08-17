/**
 * Codemod preparing consumer code for Cause & Effect 2.0 (ADR-0018, revised
 * 2026-08-17).
 *
 * Every rewrite is meaning-preserving: the new name denotes exactly what the old
 * name denotes in 1.x. What the codemod cannot decide — read-only `MutableList<T>`
 * positions (renamed from `List<T>`), `createSignal`'s shape coercion,
 * `createTask`/`createSensor` call sites, the origin guards, `DeriveCollectionOptions`
 * and `CollectionOptions` (folded into `DeriveListOptions`, not renamed), the
 * `type MutableSignal` import — stays untouched or is flagged for manual review,
 * and is covered by `MIGRATION-2.0.md`.
 *
 * `isSignal`/`isMutableSignal` are deliberately left alone and unflagged: their
 * 1.x umbrella meaning survives into 2.0 unchanged (the narrow interlude of
 * 1.5.0 was corrected; the fix ships in 1.5.1 and 2.0).
 *
 * Renames (exact identifier match only — `ListOptions`, `DeriveListOptions` etc.
 * are distinct symbols and are left alone):
 *
 * | Before                        | After                        |
 * |-------------------------------|------------------------------|
 * | `List<T>`                     | `MutableList<T>`             |
 * | `isList(x)`                   | `isMutableList(x)`           |
 * | `Collection<T>` / `DerivedList<T>` | `List<T>`              |
 * | `isCollection(x)` / `isDerivedList(x)` | `isList(x)`        |
 * | `createCollection(cb, o?)`    | `deriveList(seed, { ... })`  |
 * | `Store<T>`                    | `MutableStore<T>`            |
 * | `isStore(x)`                  | `isMutableStore(x)`          |
 * | `DerivedStore<T>`             | `Store<T>`                   |
 * | `CollectionSource<T>`         | `ListSource<T>`              |
 * | `CollectionCallback<T>`       | `ListCallback<T>`            |
 * | `CollectionChanges<T>`        | `ListChanges<T>`             |
 * | `DeriveCollectionCallback<T>` | `PerItemCallback<T>`         |
 * | `createMemo(fn, o?)` / `createComputed(fn, o?)` | `deriveComputed(fn, o?)` |
 * | `createMutableSignal(v, o?)`  | `createCell(v, o?)`          |
 * | `deriveSignal(input, o?)`     | `deriveCell(input, o?)`      |
 * | `ComputedOptions<T>` / `SensorOptions<T>` | `DeriveSignalOptions<T>` |
 * | `SensorCallback<T>`           | `SignalCallback<T>`          |
 *
 * Flagged for manual review, because no meaning-preserving rewrite exists:
 * `createSignal`, `createTask`, `createSensor`, the origin guards `isState`/
 * `isMemo`/`isTask`/`isSensor`/`isComputed`, and a still-used `type MutableSignal`
 * import.
 *
 * `--module` limits which import declarations are updated (a substring match on
 * the module specifier). It defaults to `cause-effect`.
 */
// Usage:
//   bun tools/codemod-v2.ts 'src/**/*.ts'
//   bun tools/codemod-v2.ts --module '@zeix/cause-effect' src/foo.ts
import {
	type CallExpression,
	type Identifier,
	type ImportDeclaration,
	type ObjectLiteralExpression,
	Project,
	type SourceFile,
	SyntaxKind,
} from 'ts-morph'

/* === Types === */

type MigrationReport = {
	/** Renamed identifiers, by old name. */
	renamed: Record<string, number>
	/** `createCollection(...)` calls rewritten to `deriveList(...)`. */
	createCollectionRewritten: number
	/** `createCollection(...)` calls left as-is, with the reason. */
	createCollectionSkipped: string[]
	/** Hints for positions the codemod cannot decide. */
	needsManualReview: string[]
}

/* === Constants === */

const RENAMES = new Map([
	// Composite shapes — `List`/`Store` are recycled for the readonly base, so
	// the 1.x mutable names and the 1.5.0 bridge names both move.
	['List', 'MutableList'],
	['isList', 'isMutableList'],
	['Collection', 'List'],
	['isCollection', 'isList'],
	['DerivedList', 'List'],
	['isDerivedList', 'isList'],
	['Store', 'MutableStore'],
	['isStore', 'isMutableStore'],
	['DerivedStore', 'Store'],
	// Collection-era auxiliary types
	['CollectionSource', 'ListSource'],
	['CollectionCallback', 'ListCallback'],
	['CollectionChanges', 'ListChanges'],
	['DeriveCollectionCallback', 'PerItemCallback'],
	// Single-value family
	['createMemo', 'deriveComputed'],
	['createComputed', 'deriveComputed'],
	['createMutableSignal', 'createCell'],
	['deriveSignal', 'deriveCell'],
	// Derive-family options and callback unification
	['ComputedOptions', 'DeriveSignalOptions'],
	['SensorOptions', 'DeriveSignalOptions'],
	['SensorCallback', 'SignalCallback'],
])

// Calls the codemod leaves as-is because no meaning-preserving rewrite exists.
// Each value is the hint that replaces a mechanical rewrite.
const FLAGGED_CALLS = new Map([
	[
		'createSignal',
		'createSignal() has no single 2.0 rewrite — the 1.x shape sniffing is removed; use createCell for a single value, createList/createStore for array and record shapes (on the pre-2.0 branch, createSignal was the narrow factory and becomes createCell). See MIGRATION-2.0.md',
	],
	[
		'createTask',
		'createTask() is no longer public in 2.0 — the equivalent is deriveCell(asyncFn, { initial }); task.isPending()/task.abort() become the free isPending()/abort()',
	],
	[
		'createSensor',
		'createSensor() is no longer public in 2.0 — the equivalent is deriveCell(seed, { watched }); the watched callback moves from the first argument into the options',
	],
	[
		'isState',
		'origin guards are removed in 2.0 — isState collapses into the shape guards: isMutableCell',
	],
	[
		'isMemo',
		'origin guards are removed in 2.0 — isMemo collapses into the shape guards: isCell',
	],
	[
		'isTask',
		'origin guards are removed in 2.0 — isTask collapses into isCell; asynchrony moves to the free isPending()/abort()',
	],
	[
		'isSensor',
		'origin guards are removed in 2.0 — isSensor collapses into the shape guards: isCell',
	],
	[
		'isComputed',
		'origin guards are removed in 2.0 — isComputed collapses into the shape guards: isCell',
	],
])

// Positions where an identifier names something (a member, a declaration)
// rather than references the imported symbol — renaming there would rename the
// consumer's own member or declaration, not the reference. Import specifiers
// are deliberately absent: renaming those is exactly what we want.
const NAME_PARENT_KINDS = new Set([
	SyntaxKind.PropertyAccessExpression,
	SyntaxKind.PropertyAssignment,
	SyntaxKind.ShorthandPropertyAssignment,
	SyntaxKind.PropertyDeclaration,
	SyntaxKind.PropertySignature,
	SyntaxKind.MethodDeclaration,
	SyntaxKind.MethodSignature,
	SyntaxKind.EnumMember,
	SyntaxKind.EnumDeclaration,
	SyntaxKind.QualifiedName,
	SyntaxKind.TypeAliasDeclaration,
	SyntaxKind.InterfaceDeclaration,
	SyntaxKind.ClassDeclaration,
	SyntaxKind.FunctionDeclaration,
	SyntaxKind.VariableDeclaration,
	SyntaxKind.Parameter,
	SyntaxKind.TypeParameter,
])

/* === Functions === */

function isDeclarationOrMemberName(node: Identifier): boolean {
	const parent = node.getParent()
	if (!parent) return false
	if (!NAME_PARENT_KINDS.has(parent.getKind())) return false
	// Where a parent has several identifier positions (e.g. `const List = List`),
	// only the name position is skipped; the initializer still references the symbol.
	const nameNode = (parent as { getNameNode?: () => unknown }).getNameNode
	return nameNode === undefined || nameNode.call(parent) === node
}

/**
 * Rewrites `createCollection(watched, options?)` to the `deriveList` seed form.
 * `options.value` becomes the seed; every other option carries over verbatim.
 */
function rewriteCreateCollection(
	call: CallExpression,
	report: MigrationReport,
): void {
	const args = call.getArguments()
	const watched = args[0]
	if (!watched) {
		report.createCollectionSkipped.push(
			'createCollection call without arguments was left as-is',
		)
		return
	}

	let seed = '[]'
	let rest = ''
	const options = args[1]
	if (options) {
		if (options.getKind() !== SyntaxKind.ObjectLiteralExpression) {
			report.createCollectionSkipped.push(
				`createCollection with a non-literal options argument was left as-is (${options.getText()})`,
			)
			return
		}
		const carried = (options as ObjectLiteralExpression)
			.getProperties()
			.map(property => property.getText())
			.filter(text => {
				// `value: [...]` and the shorthand `value` both name the seed.
				if (text === 'value') {
					seed = text
					return false
				}
				if (text.startsWith('value:')) {
					seed = text.slice(text.indexOf(':') + 1).trim()
					return false
				}
				return true
			})
		rest = carried.length ? `, ${carried.join(', ')}` : ''
	}

	call.replaceWithText(
		`deriveList(${seed}, { watched: ${watched.getText()}${rest} })`,
	)
	report.createCollectionRewritten += 1
}

/** Syncs the named imports of matching declarations with the names the file now uses. */
function syncImports(file: SourceFile, module: string): void {
	const matching: ImportDeclaration[] = []
	for (const declaration of file.getImportDeclarations()) {
		if (declaration.getModuleSpecifierValue().includes(module))
			matching.push(declaration)
	}
	// Without a matching import there is nothing to sync onto — the file either
	// uses a relative path into the package or re-exports it wholesale.
	const declaration = matching[0]
	if (!declaration) return
	const used = new Set(
		file
			.getDescendantsOfKind(SyntaxKind.Identifier)
			.filter(
				identifier =>
					!isDeclarationOrMemberName(identifier) &&
					identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) ===
						undefined,
			)
			.map(identifier => identifier.getText()),
	)

	for (const named of [
		'MutableList',
		'isMutableList',
		'List',
		'isList',
		'MutableStore',
		'isMutableStore',
		'Store',
		'isStore',
		'ListSource',
		'ListCallback',
		'ListChanges',
		'PerItemCallback',
		'deriveList',
		'createCell',
		'deriveCell',
		'deriveComputed',
		'DeriveSignalOptions',
		'SignalCallback',
	]) {
		if (!used.has(named)) continue
		const existing = declaration
			.getNamedImports()
			.find(specifier => specifier.getNameNode().getText() === named)
		if (!existing) declaration.addNamedImport(named)
	}

	// The rename pass may have produced a duplicate — `List` renamed onto a
	// declaration that already imported `MutableList`.
	const seen = new Set<string>()
	for (const specifier of declaration.getNamedImports()) {
		const name = specifier.getNameNode().getText()
		if (seen.has(name)) specifier.remove()
		else seen.add(name)
	}

	// Renamed-away or deprecated factories: drop the import once nothing
	// references it. Call sites the codemod only flagged (createSignal,
	// createTask, createSensor) keep their imports — those identifiers remain.
	for (const stale of [
		'createCollection',
		'createMemo',
		'createComputed',
		'createMutableSignal',
		'deriveSignal',
	]) {
		if (used.has(stale)) continue
		for (const specifier of declaration.getNamedImports()) {
			if (specifier.getNameNode().getText() === stale) specifier.remove()
		}
	}
}

/** Applies the migration to one source text and returns the result with a report. */
function migrateSource(
	source: string,
	options: { module?: string | undefined } = {},
): { output: string; report: MigrationReport } {
	const project = new Project({ useInMemoryFileSystem: true })
	const file = project.createSourceFile('migration.ts', source)
	const report: MigrationReport = {
		renamed: {},
		createCollectionRewritten: 0,
		createCollectionSkipped: [],
		needsManualReview: [],
	}

	for (const call of [
		...file.getDescendantsOfKind(SyntaxKind.CallExpression),
	]) {
		// A rewrite can remove nested calls from the tree; stale snapshots are skipped.
		if (call.wasForgotten()) continue
		const expression = call.getExpression()
		if (
			expression.getKind() === SyntaxKind.Identifier &&
			expression.getText() === 'createCollection'
		)
			rewriteCreateCollection(call, report)
	}

	let skippedOwnNames = 0
	for (const identifier of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
		const name = identifier.getText()
		const replacement = RENAMES.get(name)
		if (!replacement) continue
		if (isDeclarationOrMemberName(identifier)) {
			skippedOwnNames += 1
			continue
		}
		identifier.replaceWithText(replacement)
		report.renamed[name] = (report.renamed[name] ?? 0) + 1
	}
	if (skippedOwnNames)
		report.needsManualReview.push(
			`${skippedOwnNames} occurrence(s) of a renamed identifier name the file's own member or declaration and were not renamed — verify no reference to them was renamed by mistake`,
		)

	// A blanket `List → MutableList` rewrite preserves the 1.x meaning but also
	// renames read-only positions. In 2.0 `List` is the readonly base — the very
	// name these positions had before the rename — so they can simply keep it.
	if (report.renamed.List)
		report.needsManualReview.push(
			`${report.renamed.List} List reference(s) renamed to MutableList to preserve the 1.x mutable meaning; positions that only read can stay List<T> — the 2.0 readonly base`,
		)

	// Calls with no meaning-preserving rewrite: counted per callee, left as-is,
	// and enumerated for the manual audit MIGRATION-2.0.md walks through.
	const flaggedCounts = new Map<string, number>()
	for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
		if (call.wasForgotten()) continue
		const expression = call.getExpression()
		if (expression.getKind() !== SyntaxKind.Identifier) continue
		const name = expression.getText()
		if (!FLAGGED_CALLS.has(name)) continue
		flaggedCounts.set(name, (flaggedCounts.get(name) ?? 0) + 1)
	}
	for (const [name, count] of flaggedCounts)
		report.needsManualReview.push(
			`${count} ${name}() call(s) left as-is: ${FLAGGED_CALLS.get(name)}`,
		)

	// `type MutableSignal` has no 2.0 export — 1.4's structural type and 1.5's
	// narrow bridge type both need a decision, so a still-used import is flagged
	// rather than rewritten. Import-precise: an own type of that name is not
	// flagged unless it was imported from the module.
	const module = options.module ?? 'cause-effect'
	for (const declaration of file.getImportDeclarations()) {
		if (!declaration.getModuleSpecifierValue().includes(module)) continue
		const imported = declaration
			.getNamedImports()
			.some(specifier => specifier.getNameNode().getText() === 'MutableSignal')
		if (!imported) continue
		const stillUsed = file
			.getDescendantsOfKind(SyntaxKind.Identifier)
			.some(
				identifier =>
					identifier.getText() === 'MutableSignal' &&
					identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) ===
						undefined &&
					!isDeclarationOrMemberName(identifier),
			)
		if (stillUsed) {
			report.needsManualReview.push(
				"type MutableSignal has no 2.0 export — annotate as Signal<T> & { set(value: T): void }, or use the shape's mutable type (MutableCell/MutableList/MutableStore)",
			)
			break
		}
	}

	// 1.x `isStore` checks the shape tag only, so it also matches a derived store;
	// `isMutableStore` adds the write-capability check and rejects one. A call site
	// that sees derived stores changes behavior under this rename.
	if (report.renamed.isStore)
		report.needsManualReview.push(
			`${report.renamed.isStore} isStore reference(s) renamed to isMutableStore; isMutableStore rejects a readonly Store (a deriveStore result, formerly DerivedStore), so verify no call site relied on isStore matching one`,
		)

	syncImports(file, options.module ?? 'cause-effect')

	return { output: file.getFullText(), report }
}

/* === CLI === */

if (import.meta.main) {
	const argv = process.argv.slice(2)
	const moduleFlag = argv.indexOf('--module')
	const module = moduleFlag !== -1 ? argv.splice(moduleFlag, 2)[1] : undefined
	const patterns = argv
	if (patterns.length === 0) {
		console.error(
			"Usage: bun tools/codemod-v2.ts [--module <name>] '<glob-or-path>...'",
		)
		process.exit(1)
	}

	const project = new Project({ skipAddingFilesFromTsConfig: true })
	const files = project.addSourceFilesAtPaths(patterns)
	if (files.length === 0) {
		console.error(`No files matched: ${patterns.join(', ')}`)
		process.exit(1)
	}

	let total = 0
	for (const file of files) {
		const { output, report } = migrateSource(file.getFullText(), { module })
		if (output !== file.getFullText()) {
			file.replaceWithText(output)
			file.saveSync()
			total += 1
		}
		const parts = Object.entries(report.renamed).map(
			([from, n]) => `${from}→${RENAMES.get(from)} ×${n}`,
		)
		if (report.createCollectionRewritten)
			parts.push(
				`createCollection→deriveList ×${report.createCollectionRewritten}`,
			)
		for (const skipped of report.createCollectionSkipped)
			console.warn(`  ⚠ ${file.getBaseName()}: ${skipped}`)
		for (const hint of report.needsManualReview)
			console.warn(`  ⚠ ${file.getBaseName()}: ${hint}`)
		console.log(`${file.getBaseName()}: ${parts.join(', ') || 'no changes'}`)
	}
	console.log(`\n${total}/${files.length} file(s) modified.`)
}

export type { MigrationReport }
export { migrateSource }
