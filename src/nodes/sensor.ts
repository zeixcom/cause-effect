import {
	activeSink,
	type Cleanup,
	type ComputedOptions,
	defaultEquals,
	link,
	type StateNode,
	setState,
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../graph'
import { isObjectOfType, isSyncFunction } from '../util'

/* === Types === */

/**
 * A read-only signal that tracks external input and updates a state value as long as it is active.
 *
 * @template T - The type of value produced by the sensor
 */
type Sensor<T extends {}> = {
	readonly [Symbol.toStringTag]: 'Sensor'

	/**
	 * Gets the current value of the sensor.
	 * Updates its state value if the sensor is active.
	 * When called inside another reactive context, creates a dependency.
	 * @returns The sensor value
	 * @throws UnsetSignalValueError If the sensor value is still unset when read.
	 */
	get(): T
}

/**
 * A callback function for sensors when the sensor starts being watched.
 *
 * @template T - The type of value observed
 * @param set - A function to set the observed value
 * @returns A cleanup function when the sensor stops being watched
 */
type SensorCallback<T extends {}> = (set: (next: T) => void) => Cleanup

/* === Constants === */

const TYPE_SENSOR = 'Sensor'

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
	options?: ComputedOptions<T>,
): Sensor<T> => {
	validateCallback(TYPE_SENSOR, start, isSyncFunction)
	if (options?.value !== undefined)
		validateSignalValue(TYPE_SENSOR, options.value, options?.guard)

	const node: StateNode<T> = {
		value: options?.value as T,
		sinks: null,
		sinksTail: null,
		equals: options?.equals ?? defaultEquals,
		guard: options?.guard,
		stop: undefined,
	}

	return {
		[Symbol.toStringTag]: TYPE_SENSOR,
		get(): T {
			if (activeSink) {
				if (!node.sinks)
					node.stop = start((next: T): void => {
						validateSignalValue('Sensor', next, node.guard)
						setState(node, next)
					})
				link(node, activeSink)
			}
			validateReadValue(TYPE_SENSOR, node.value)
			return node.value
		},
	}
}

/**
 * Checks if a value is a Sensor signal.
 *
 * @param value - The value to check
 * @returns True if the value is a Sensor
 */
const isSensor = <T extends {} = unknown & {}>(
	value: unknown,
): value is Sensor<T> => isObjectOfType(value, TYPE_SENSOR)

export { createSensor, isSensor, type Sensor, type SensorCallback }
