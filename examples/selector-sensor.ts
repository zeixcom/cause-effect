import { createMemo, type Memo } from '..'

/* === Types === */

// Split a comma-separated selector into individual selectors
type SplitByComma<S extends string> = S extends `${infer First},${infer Rest}`
	? [TrimWhitespace<First>, ...SplitByComma<Rest>]
	: [TrimWhitespace<S>]

// Trim leading/trailing whitespace from a string
type TrimWhitespace<S extends string> = S extends ` ${infer Rest}`
	? TrimWhitespace<Rest>
	: S extends `${infer Rest} `
		? TrimWhitespace<Rest>
		: S

// Extract the rightmost selector part from combinator selectors (space, >, +, ~)
type ExtractRightmostSelector<S extends string> =
	S extends `${string} ${infer Rest}`
		? ExtractRightmostSelector<Rest>
		: S extends `${string}>${infer Rest}`
			? ExtractRightmostSelector<Rest>
			: S extends `${string}+${infer Rest}`
				? ExtractRightmostSelector<Rest>
				: S extends `${string}~${infer Rest}`
					? ExtractRightmostSelector<Rest>
					: S

// Extract tag name from a simple selector (without combinators)
type ExtractTagFromSimpleSelector<S extends string> =
	S extends `${infer T}.${string}`
		? T
		: S extends `${infer T}#${string}`
			? T
			: S extends `${infer T}:${string}`
				? T
				: S extends `${infer T}[${string}`
					? T
					: S

// Main extraction logic for a single selector
type ExtractTag<S extends string> = ExtractTagFromSimpleSelector<
	ExtractRightmostSelector<S>
>

// Normalize to lowercase and ensure it's a known HTML tag
type KnownTag<S extends string> =
	Lowercase<ExtractTag<S>> extends
		| keyof HTMLElementTagNameMap
		| keyof SVGElementTagNameMap
		| keyof MathMLElementTagNameMap
		? Lowercase<ExtractTag<S>>
		: never

// Get element type from a single selector
type ElementFromSingleSelector<S extends string> =
	KnownTag<S> extends never
		? HTMLElement
		: KnownTag<S> extends keyof HTMLElementTagNameMap
			? HTMLElementTagNameMap[KnownTag<S>]
			: KnownTag<S> extends keyof SVGElementTagNameMap
				? SVGElementTagNameMap[KnownTag<S>]
				: KnownTag<S> extends keyof MathMLElementTagNameMap
					? MathMLElementTagNameMap[KnownTag<S>]
					: HTMLElement

// Map a tuple of selectors to a union of their element types
type ElementsFromSelectorArray<Selectors extends readonly string[]> = {
	[K in keyof Selectors]: Selectors[K] extends string
		? ElementFromSingleSelector<Selectors[K]>
		: never
}[number]

// Main type: handle both single selectors and comma-separated selectors
type ElementFromSelector<S extends string> = S extends `${string},${string}`
	? ElementsFromSelectorArray<SplitByComma<S>>
	: ElementFromSingleSelector<S>

type ElementChanges<E extends Element> = {
	current: Set<E>
	added: E[]
	removed: E[]
}

/* === Internal Functions === */

/**
 * Extract attribute names from a CSS selector
 * Handles various attribute selector formats: .class, #id, [attr], [attr=value], [attr^=value], etc.
 *
 * @param {string} selector - CSS selector to parse
 * @returns {string[]} - Array of attribute names found in the selector
 */
const extractAttributes = (selector: string): string[] => {
	const attributes = new Set<string>()
	if (selector.includes('.')) attributes.add('class')
	if (selector.includes('#')) attributes.add('id')
	if (selector.includes('[')) {
		const parts = selector.split('[')
		for (let i = 1; i < parts.length; i++) {
			const part = parts[i]
			if (!part.includes(']')) continue
			const attrName = part
				.split('=')[0]
				.trim()
				.replace(/[^a-zA-Z0-9_-]/g, '')
			if (attrName) attributes.add(attrName)
		}
	}
	return [...attributes]
}

/* === Exported Functions === */

/**
 * Observe changes to elements matching a CSS selector.
 * Returns a Memo that tracks which elements were added and removed.
 * The MutationObserver is lazily activated when an effect first reads
 * the memo, and disconnected when no effects are watching.
 *
 * @since 0.16.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A Memo of element changes (current set, added, removed)
 */
function observeSelectorChanges<S extends string>(
	parent: ParentNode,
	selector: S,
): Memo<ElementChanges<ElementFromSelector<S>>>
function observeSelectorChanges<E extends Element>(
	parent: ParentNode,
	selector: string,
): Memo<ElementChanges<E>>
function observeSelectorChanges<S extends string>(
	parent: ParentNode,
	selector: S,
): Memo<ElementChanges<ElementFromSelector<S>>> {
	type E = ElementFromSelector<S>

	return createMemo(
		(prev: ElementChanges<E>) => {
			const next = new Set(
				Array.from(parent.querySelectorAll<E>(selector)),
			)
			const added: E[] = []
			const removed: E[] = []

			for (const el of next) if (!prev.current.has(el)) added.push(el)
			for (const el of prev.current) if (!next.has(el)) removed.push(el)

			return { current: next, added, removed }
		},
		{
			value: { current: new Set<E>(), added: [], removed: [] },
			watched: invalidate => {
				const observerConfig: MutationObserverInit = {
					childList: true,
					subtree: true,
				}
				const observedAttributes = extractAttributes(selector)
				if (observedAttributes.length) {
					observerConfig.attributes = true
					observerConfig.attributeFilter = observedAttributes
				}
				const observer = new MutationObserver(() => invalidate())
				observer.observe(parent, observerConfig)
				return () => observer.disconnect()
			},
		},
	)
}

export { observeSelectorChanges, type ElementChanges }
