/**
 * Codemod preparing consumer code for Cause & Effect 2.0 (ADR-0018).
 *
 * Every rewrite is meaning-preserving: the new names denote exactly what the old
 * names denote in 1.x. What the codemod cannot decide — read-only `List<T>`
 * positions, origin guards, the `createSignal` shape coercion — stays untouched
 * and is covered by `MIGRATION-2.0.md`.
 *
 * Renames (exact identifier match only — `ListOptions`, `CollectionCallback` etc.
 * are distinct symbols and are left alone):
 *
 * | Before                     | After                        |
 * |----------------------------|------------------------------|
 * | `List<T>`                  | `MutableList<T>`             |
 * | `isList(x)`                | `isMutableList(x)`           |
 * | `Collection<T>`            | `DerivedList<T>`             |
 * | `isCollection(x)`          | `isDerivedList(x)`           |
 * | `createCollection(cb, o?)` | `deriveList(seed, { ... })`  |
 * | `Store<T>`                 | `MutableStore<T>`            |
 * | `isStore(x)`               | `isMutableStore(x)`          |
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
	['List', 'MutableList'],
	['isList', 'isMutableList'],
	['Collection', 'DerivedList'],
	['isCollection', 'isDerivedList'],
	['Store', 'MutableStore'],
	['isStore', 'isMutableStore'],
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
		'DerivedList',
		'isDerivedList',
		'deriveList',
		'MutableStore',
		'isMutableStore',
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

	// createCollection is deprecated; drop the import once nothing references it.
	if (!used.has('createCollection'))
		for (const specifier of declaration.getNamedImports()) {
			if (specifier.getNameNode().getText() === 'createCollection')
				specifier.remove()
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
			`${skippedOwnNames} occurrence(s) of List/Collection/Store name the file's own member or declaration and were not renamed — verify no reference to them was renamed by mistake`,
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
