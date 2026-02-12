import {
	type Collection,
	createCollection,
	createSensor,
	SKIP_EQUALITY,
} from '..'

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

/* === Internal Functions === */

/**
 * Check if a node is an Element
 *
 * @param {Node} node - node to check
 * @returns {boolean} - `true` if node is an element node, otherwise `false`
 */
const isElement = /*#__PURE__*/ (node: Node): node is Element =>
	node.nodeType === Node.ELEMENT_NODE

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
 * Create a collection of elements from a parent node and a CSS selector.
 *
 * @since 0.15.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A collection signal of elements
 */
function createElementCollection<S extends string>(
	parent: ParentNode,
	selector: S,
): Collection<ElementFromSelector<S>>
function createElementCollection<E extends Element>(
	parent: ParentNode,
	selector: string,
): Collection<E>
function createElementCollection<S extends string>(
	parent: ParentNode,
	selector: S,
): Collection<ElementFromSelector<S>> {
	const findMatches = (nodes: NodeList) => {
		const elements = Array.from(nodes).filter(isElement)
		const found: ElementFromSelector<S>[] = []
		for (const element of elements) {
			if (element.matches(selector))
				found.push(element as ElementFromSelector<S>)
			found.push(
				...Array.from(
					element.querySelectorAll<ElementFromSelector<S>>(selector),
				),
			)
		}
		return found
	}

	return createCollection(
		apply => {
			const elements = Array.from(
				parent.querySelectorAll<ElementFromSelector<S>>(selector),
			)
			apply({ add: elements })

			const observer = new MutationObserver(mutations => {
				const added: ElementFromSelector<S>[] = []
				const removed: ElementFromSelector<S>[] = []

				for (const mutation of mutations) {
					if (mutation.type === 'childList') {
						if (mutation.addedNodes.length)
							added.push(...findMatches(mutation.addedNodes))
						if (mutation.removedNodes.length)
							removed.push(...findMatches(mutation.removedNodes))
					} else if (mutation.type === 'attributes') {
						const target = mutation.target as ElementFromSelector<S>
						if (isElement(target)) {
							const wasMatching = elements.includes(target)
							const isMatching = target.matches(selector)
							if (wasMatching && !isMatching) removed.push(target)
							else if (!wasMatching && isMatching)
								added.push(target)
						}
					}
				}

				if (added.length || removed.length)
					apply({ add: added, remove: removed })
			})
			const observerConfig: MutationObserverInit = {
				childList: true,
				subtree: true,
			}
			const observedAttributes = extractAttributes(selector)
			if (observedAttributes.length) {
				observerConfig.attributes = true
				observerConfig.attributeFilter = observedAttributes
			}
			observer.observe(parent, observerConfig)
			return () => observer.disconnect()
		},
		{
			keyConfig: el => el.id ?? el.dataset.key,
			createItem: (_key, element) =>
				createSensor(() => () => {}, {
					value: element,
					equals: SKIP_EQUALITY,
				}),
		},
	)
}

export { createElementCollection }
