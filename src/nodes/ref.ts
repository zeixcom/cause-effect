import {
	activeSink,
	batchDepth,
	type Cleanup,
	flush,
	link,
	propagate,
	type RefNode,
	TYPE_MEMO,
} from '../graph'
import type { Memo } from './memo'

/* === Types === */

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
 * @template T - The type of the referenced object
 */
const createRef = <T extends {}>(value: T, start: RefCallback): Memo<T> => {
	const node: RefNode<T> = {
		value,
		sinks: null,
		sinksTail: null,
		stop: undefined,
	}

	const notify = () => {
		for (let e = node.sinks; e; e = e.nextSink) propagate(e.sink)
		if (batchDepth === 0) flush()
	}

	const ref: Memo<T> = {
		[Symbol.toStringTag]: TYPE_MEMO,
		get(): T {
			if (activeSink) {
				if (!node.sinks) node.stop = start(notify)
				link(node, activeSink)
			}
			return node.value
		},
	}

	return ref
}

export { createRef, type RefCallback }
