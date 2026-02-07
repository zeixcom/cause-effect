import {
	activeSink,
	batchDepth,
	type Cleanup,
	flush,
	link,
	propagate,
	type RefNode,
	validateCallback,
	validateSignalValue,
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

/* === Constants === */

const TYPE_REF = 'Ref'

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
 * @template T - The type of the referenced object
 */
const createRef = <T extends {}>(value: T, start: RefCallback): Ref<T> => {
	validateSignalValue('Ref', value)
	validateCallback('Ref', start, isSyncFunction)

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
 * @param value - The value to check
 * @returns True if the value is a Ref
 */
const isRef = <T extends {} = unknown & {}>(value: unknown): value is Ref<T> =>
	isObjectOfType(value, TYPE_REF)

export { createRef, isRef, type Ref, type RefCallback }
