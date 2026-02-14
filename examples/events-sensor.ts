import { createSensor, isSensor, type Sensor } from '..'

/* === Types === */

type ReservedWords =
	| 'constructor'
	| 'prototype'
	| '__proto__'
	| 'toString'
	| 'valueOf'
	| 'hasOwnProperty'
	| 'isPrototypeOf'
	| 'propertyIsEnumerable'
	| 'toLocaleString'

type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>

type Component<P extends ComponentProps> = HTMLElement & P

type UI = Record<string, Element | Sensor<Element[]>>

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

type EventHandler<
	T extends {},
	Evt extends Event,
	U extends UI,
	E extends Element,
> = (context: {
	event: Evt
	ui: U
	target: E
	prev: T
}) => T | void | Promise<void>

type EventHandlers<T extends {}, U extends UI, E extends Element> = {
	[K in keyof HTMLElementEventMap]?: EventHandler<T, EventType<K>, U, E>
}

type ElementFromKey<U extends UI, K extends keyof U> = NonNullable<
	U[K] extends Sensor<infer E extends Element>
		? E
		: U[K] extends Element
			? U[K]
			: never
>

type Parser<T extends {}, U extends UI> = (
	ui: U,
	value: string | null | undefined,
	old?: string | null,
) => T

type Reader<T extends {}, U extends UI> = (ui: U) => T
type Fallback<T extends {}, U extends UI> = T | Reader<T, U>

type ParserOrFallback<T extends {}, U extends UI> =
	| Parser<T, U>
	| Fallback<T, U>

/* === Internal === */

const pendingElements = new Set<Element>()
const tasks = new WeakMap<Element, () => void>()
let requestId: number | undefined

const runTasks = () => {
	requestId = undefined
	const elements = Array.from(pendingElements)
	pendingElements.clear()
	for (const element of elements) tasks.get(element)?.()
}

const requestTick = () => {
	if (requestId) cancelAnimationFrame(requestId)
	requestId = requestAnimationFrame(runTasks)
}

const schedule = (element: Element, task: () => void) => {
	tasks.set(element, task)
	pendingElements.add(element)
	requestTick()
}

// High-frequency events that are passive by default and should be scheduled
const PASSIVE_EVENTS = new Set([
	'scroll',
	'resize',
	'mousewheel',
	'touchstart',
	'touchmove',
	'wheel',
])

const isReader = <T extends {}, U extends UI>(
	value: unknown,
): value is Reader<T, U> => typeof value === 'function'

const getFallback = <T extends {}, U extends UI>(
	ui: U,
	fallback: ParserOrFallback<T, U>,
): T => (isReader<T, U>(fallback) ? fallback(ui) : (fallback as T))

/* === Exported Functions === */

/**
 * Produce an event-driven sensor from transformed event data
 *
 * @since 0.16.0
 * @param {S} key - name of UI key
 * @param {ParserOrFallback<T>} init - Initial value, reader or parser
 * @param {EventHandlers<T, ElementFromSelector<S>, C>} events - Transformation functions for events
 * @returns {Extractor<Sensor<T>, C>} Extractor function for value from event
 */
const createEventsSensor =
	<T extends {}, P extends ComponentProps, U extends UI, K extends keyof U>(
		init: ParserOrFallback<T, U>,
		key: K,
		events: EventHandlers<T, U, ElementFromKey<U, K>>,
	): ((ui: U & { host: Component<P> }) => Sensor<T>) =>
	(ui: U & { host: Component<P> }) => {
		const { host } = ui
		let value: T = getFallback(ui, init)
		const targets = isSensor<ElementFromKey<U, K>[]>(ui[key])
			? ui[key].get()
			: [ui[key] as ElementFromKey<U & { host: Component<P> }, K>]
		const eventMap = new Map<string, EventListener>()

		const getTarget = (
			eventTarget: Node,
		): ElementFromKey<U, K> | undefined => {
			for (const t of targets)
				if (t.contains(eventTarget)) return t as ElementFromKey<U, K>
		}

		return createSensor<T>(
			set => {
				for (const [type, handler] of Object.entries(events)) {
					const options = { passive: PASSIVE_EVENTS.has(type) }
					const listener = (e: Event) => {
						const eventTarget = e.target as Node
						if (!eventTarget) return
						const target = getTarget(eventTarget)
						if (!target) return
						e.stopPropagation()

						const task = () => {
							try {
								const next = handler({
									event: e as any,
									ui,
									target,
									prev: value,
								})
								if (next == null || next instanceof Promise)
									return
								if (!Object.is(next, value)) {
									value = next
									set(next)
								}
							} catch (error) {
								e.stopImmediatePropagation()
								throw error
							}
						}
						if (options.passive) schedule(host, task)
						else task()
					}
					eventMap.set(type, listener)
					host.addEventListener(type, listener, options)
				}
				return () => {
					if (eventMap.size) {
						for (const [type, listener] of eventMap)
							host.removeEventListener(type, listener)
						eventMap.clear()
					}
				}
			},
			{ value },
		)
	}

export { createEventsSensor, type EventHandler, type EventHandlers }
