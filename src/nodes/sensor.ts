import {
	activeSink,
	type Cleanup,
	defaultEquals,
	link,
	type SignalOptions,
	type StateNode,
	setState,
	TYPE_MEMO,
	validateSignalValue,
} from '../graph'
import type { Memo } from './memo'

/* === Types === */

/**
 * A callback function for sensors when the sensor starts being watched.
 *
 * @template T - The type of value observed
 * @param set - A function to set the observed value
 * @returns A cleanup function when the sensor stops being watched
 */
type SensorCallback<T extends {}> = (set: (next: T) => void) => Cleanup

/* === Exported Functions === */

/**
 * Creates a sensor that tracks external input and updates a state value as long as it is active.
 * Sensors get activated when they are first accessed and deactivated when they are no longer needed.
 *
 * @template T - The type of value stored in the state
 * @param start - The callback function that starts the sensor and returns a cleanup function.
 * @param options - Optional options for the sensor.
 * @returns The sensor object.
 *
 * @example
 * ```ts
 * const mousePos = createSensor<{ x: number; y: number }>((set) => {
 *   const handler = (e: MouseEvent) => {
 *     set({ x: e.clientX, y: e.clientY });
 *   };
 *
 *   window.addEventListener('mousemove', handler);
 *   return () => {
 *     window.removeEventListener('mousemove', handler);
 *   };
 * });
 * ```
 */
const createSensor = <T extends {}>(
	start: SensorCallback<T>,
	options?: SignalOptions<T>,
): Memo<T> => {
	const node: StateNode<T> = {
		value: undefined as unknown as T,
		sinks: null,
		sinksTail: null,
		equals: options?.equals ?? defaultEquals,
		guard: options?.guard,
		stop: undefined,
	}

	const set = (next: T): void => {
		validateSignalValue('Sensor', next, node.guard)
		setState(node, next)
	}

	const sensor: Memo<T> = {
		[Symbol.toStringTag]: TYPE_MEMO,
		get(): T {
			if (activeSink) {
				if (!node.sinks) node.stop = start(set)
				link(node, activeSink)
			}
			return node.value
		},
	}

	return sensor
}

export { createSensor, type SensorCallback }
