/**
 * Codemod preparing consumer code for Cause & Effect 2.0 (ADR-0018, revised
 * 2026-08-17: the single-value shape is `Cell`; `Signal` stays the umbrella).
 *
 * Every rewrite is meaning-preserving: the new names denote exactly what the old
 * names denote in 1.x. What the codemod cannot decide — read-only `List<T>`
 * positions, origin guards, `createSignal` (its shape dispatch is removed in 2.0
 * with no single replacement), `DeriveCollectionOptions` (folded into
 * `DeriveListOptions`, not renamed) — stays untouched and is covered by
 * `MIGRATION-2.0.md`.
 *
 * Renames (exact identifier match only — `ListOptions`, `DeriveListOptions` etc.
 * are distinct symbols and are left alone):
 *
 * | Before                        | After                        |
 * |-------------------------------|------------------------------|
 * | `List<T>`                     | `MutableList<T>`             |
 * | `isList(x)`                   | `isMutableList(x)`           |
 * | `Collection<T>`               | `DerivedList<T>`             |
 * | `isCollection(x)`             | `isDerivedList(x)`           |
 * | `createCollection(cb, o?)`    | `deriveList(seed, { ... })`  |
 * | `Store<T>`                    | `MutableStore<T>`            |
 * | `isStore(x)`                  | `isMutableStore(x)`          |
 * | `CollectionSource<T>`         | `ListSource<T>`              |
 * | `CollectionCallback<T>`       | `ListCallback<T>`            |
 * | `CollectionChanges<T>`        | `ListChanges<T>`             |
 * | `DeriveCollectionCallback<T>` | `PerItemCallback<T>`         |
 * | `createComputed(fn, o?)`      | `deriveCell(fn, o?)` — `o.value` becomes `o.initial` |
 * | `deriveSignal(input, o?)`     | `deriveCell(input, o?)`      |
 * | `DeriveSignalOptions<T>`      | `DeriveCellOptions<T>`       |
 *
 * `createMutableSignal(v)` calls are rewritten by argument shape when the argument
 * is a literal — `createCell(v)` for a single value, `createList(v)` for an array,
 * `createStore(v)` for a record — and flagged for manual review otherwise.
 * `createSignal(...)` calls are always flagged, never rewritten.
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
	type PropertyAssignment,
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
	/** `createMutableSignal(...)` calls rewritten to `createCell`/`createList`/`createStore`. */
	createMutableSignalRewritten: number
	/** Hints for positions the codemod cannot decide. */
	needsManualReview: string[]
}

/* === Constants === */

const RENAMES = new Map([
	['List', 'MutableList'],
	['isList', 'isMutableList'],
	['Collection', 'DerivedList'],
	['isCollection', 'isDerivedList'],
	['Store', 'MutableStore'],
	['isStore', 'isMutableStore'],
	['CollectionSource', 'ListSource'],
	['CollectionCallback', 'ListCallback'],
	['CollectionChanges', 'ListChanges'],
	['DeriveCollectionCallback', 'PerItemCallback'],
	['createComputed', 'deriveCell'],
	['deriveSignal', 'deriveCell'],
	['DeriveSignalOptions', 'DeriveCellOptions'],
])

// Calls the codemod leaves as-is because no meaning-preserving rewrite exists.
// Each value is the hint that replaces a mechanical rewrite.
const FLAGGED_CALLS = new Map([
	[
		'createSignal',
		'createSignal() has no meaning-preserving 2.0 rewrite — the shape dispatch is removed in 2.0; use createCell for a single value, createList/createStore for array and record shapes, and pass an existing signal through unwrapped. See MIGRATION-2.0.md',
	],
])

// Literal argument kinds routed to `createCell` — everything else a literal can
// be (array, record) goes to the shape factory, and non-literals are flagged.
const SINGLE_VALUE_LITERAL_KINDS = new Set([
	SyntaxKind.NumericLiteral,
	SyntaxKind.StringLiteral,
	SyntaxKind.NoSubstitutionTemplateLiteral,
	SyntaxKind.TrueKeyword,
	SyntaxKind.FalseKeyword,
	SyntaxKind.BigIntLiteral,
	SyntaxKind.NullKeyword,
	SyntaxKind.UndefinedKeyword,
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

/**
 * Rewrites `createMutableSignal(v)` by the shape of a literal argument —
 * `createCell(v)` for a single value, `createList(v)` for an array,
 * `createStore(v)` for a record — exactly the factories the 1.x function
 * dispatches to. `createCell` is the narrow single-value factory, so a blanket
 * rename would silently change array and record call sites. Non-literal
 * arguments are flagged: the codemod cannot see the runtime shape.
 */
function rewriteCreateMutableSignal(
	call: CallExpression,
	report: MigrationReport,
): void {
	const arg = call.getArguments()[0]
	if (!arg) {
		report.needsManualReview.push(
			'createMutableSignal call without arguments was left as-is',
		)
		return
	}
	const kind = arg.getKind()
	let target: string
	if (SINGLE_VALUE_LITERAL_KINDS.has(kind)) target = 'createCell'
	else if (kind === SyntaxKind.ArrayLiteralExpression) target = 'createList'
	else if (kind === SyntaxKind.ObjectLiteralExpression) target = 'createStore'
	else {
		report.needsManualReview.push(
			`createMutableSignal(${arg.getText()}) left as-is: the argument is not a literal — use createCell for a single value, createList/createStore for array and record shapes`,
		)
		return
	}
	call.replaceWithText(`${target}(${arg.getText()})`)
	report.createMutableSignalRewritten += 1
}

/**
 * Rewrites `options.value` to `options.initial` on a `createComputed(fn, options)`
 * call with a literal options object — the vocabulary change that accompanies the
 * `createComputed` → `deriveCell` rename. Non-literal options are flagged; the
 * callee itself is renamed by the identifier pass.
 */
function rewriteComputedOptions(
	call: CallExpression,
	report: MigrationReport,
): void {
	const options = call.getArguments()[1]
	if (!options) return
	if (options.getKind() !== SyntaxKind.ObjectLiteralExpression) {
		report.needsManualReview.push(
			`createComputed with a non-literal options argument was left as-is (${options.getText()}) — rename options.value to options.initial manually`,
		)
		return
	}
	const properties = (options as ObjectLiteralExpression).getProperties()
	const nameOf = (property: (typeof properties)[number]) =>
		(property as { getName?: () => string }).getName?.()
	const valueProps = properties.filter(property => nameOf(property) === 'value')
	if (!valueProps.length) return
	if (properties.some(property => nameOf(property) === 'initial')) {
		report.needsManualReview.push(
			'createComputed options contain both value and initial — resolve manually',
		)
		return
	}
	for (const property of valueProps) {
		if (property.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
			property.replaceWithText('initial: value')
		} else {
			const assignment = property as PropertyAssignment
			assignment.replaceWithText(
				`initial: ${assignment.getInitializer()?.getText()}`,
			)
		}
	}
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
		'DerivedList',
		'isDerivedList',
		'deriveList',
		'MutableStore',
		'isMutableStore',
		'ListSource',
		'ListCallback',
		'ListChanges',
		'PerItemCallback',
		'createCell',
		'createList',
		'createStore',
		'deriveCell',
		'DeriveCellOptions',
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

	// Renamed-away or rewritten-away factories: drop the import once nothing
	// references it. Call sites the codemod only flagged (createSignal,
	// createMutableSignal with a non-literal argument) keep their imports —
	// those identifiers remain.
	for (const stale of [
		'createCollection',
		'createComputed',
		'createMutableSignal',
		'deriveSignal',
		'DeriveSignalOptions',
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
		createMutableSignalRewritten: 0,
		needsManualReview: [],
	}

	for (const call of [
		...file.getDescendantsOfKind(SyntaxKind.CallExpression),
	]) {
		// A rewrite can remove nested calls from the tree; stale snapshots are skipped.
		if (call.wasForgotten()) continue
		const expression = call.getExpression()
		if (expression.getKind() !== SyntaxKind.Identifier) continue
		const callee = expression.getText()
		if (callee === 'createCollection') rewriteCreateCollection(call, report)
		else if (callee === 'createMutableSignal')
			rewriteCreateMutableSignal(call, report)
		else if (callee === 'createComputed') rewriteComputedOptions(call, report)
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
			`${skippedOwnNames} occurrence(s) of a renamed identifier (List/Collection/Store/CollectionSource/CollectionCallback/CollectionChanges/DeriveCollectionCallback) name the file's own member or declaration and were not renamed — verify no reference to them was renamed by mistake`,
		)

	// A blanket `List → MutableList` rewrite preserves the 1.x meaning but also
	// renames read-only positions, where `DerivedList` is available today and
	// `List` is the v2 name. The codemod cannot tell which a position is.
	if (report.renamed.List)
		report.needsManualReview.push(
			`${report.renamed.List} List reference(s) renamed to MutableList; narrow read-only positions to DerivedList if you want the v2 meaning early`,
		)

	// 1.x `isStore` checks the shape tag only, so it also matches a `DerivedStore`;
	// `isMutableStore` adds the write-capability check and rejects one. A call site
	// that sees derived stores changes behavior under this rename.
	if (report.renamed.isStore)
		report.needsManualReview.push(
			`${report.renamed.isStore} isStore reference(s) renamed to isMutableStore; isMutableStore rejects a DerivedStore, so verify no call site relied on isStore matching a deriveStore result`,
		)

	// `createComputed(asyncFn)` returned a `Task` carrying the deprecated
	// `.isPending()`/`.abort()` methods; `deriveCell` returns `Signal<T>`, which
	// has neither. The rename is meaning-preserving for the value, but those
	// member calls stop compiling — enumerate them for the manual audit.
	if (report.renamed.createComputed)
		report.needsManualReview.push(
			`${report.renamed.createComputed} createComputed reference(s) renamed to deriveCell; an async callback returned a Task with .isPending()/.abort() methods — switch those call sites to the free isPending(signal)/abort(signal)`,
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
		if (report.createMutableSignalRewritten)
			parts.push(
				`createMutableSignal→createCell/createList/createStore ×${report.createMutableSignalRewritten}`,
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
