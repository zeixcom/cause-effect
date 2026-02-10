import { validateCallback, validateSignalValue } from '../errors'
import {
	activeSink,
	batchDepth,
	type Cleanup,
	flush,
	link,
	propagate,
	type RefNode,
	TYPE_REF,
} from '../graph'
import { isObjectOfType, isSyncFunction } from '../util'

/* === Types === */

/**
 * A read-only signal that holds an external reference.
 *
 * @template T - The type of value produced by the sensor
 */
type Ref<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Ref'

	/**
	 * Gets the reference.
	 * Notifies subscribers when the reference has updates.
	 * When called inside another reactive context, creates a dependency.
	 * @returns The reference value
	 */
	get(): T
}

/**
 * A callback function for refs when the reference starts being watched.
 *
 * @param notify - A function to notify subscribers when the reference has updates
 * @returns A cleanup function when the reference stops being watched
 */
type RefCallback = (notify: () => void) => Cleanup

/* === Exported Functions === */

/**
 * A reactive reference to an external, immutable object.
 * The reference value itself never changes, but subscribers can be notified when
 * properties of the referenced object change. Only active when it has subscribers.
 *
 * Use this for:
 * - DOM elements (notify on attribute changes, mutations, intersection, etc.)
 * - Network connections (notify on status changes)
 * - External resources that need observation setup/teardown
 *
 * @since 0.18.0
 * @template T - The type of the referenced object
 */
function createRef<T extends {}>(value: T, start: RefCallback): Ref<T> {
	validateSignalValue(TYPE_REF, value)
	validateCallback(TYPE_REF, start, isSyncFunction)

	const node: RefNode<T> = {
		value,
		sinks: null,
		sinksTail: null,
		stop: undefined,
	}

	return {
		[Symbol.toStringTag]: TYPE_REF,
		get(): T {
			if (activeSink) {
				if (!node.sinks)
					node.stop = start(() => {
						for (let e = node.sinks; e; e = e.nextSink)
							propagate(e.sink)
						if (batchDepth === 0) flush()
					})
				link(node, activeSink)
			}
			return node.value
		},
	}
}

/**
 * Checks if a value is a Ref signal.
 *
 * @since 0.18.0
 * @param value - The value to check
 * @returns True if the value is a Ref
 */
function isRef<T extends {} = unknown & {}>(value: unknown): value is Ref<T> {
	return isObjectOfType(value, TYPE_REF)
}

export { createRef, isRef, type Ref, type RefCallback }
