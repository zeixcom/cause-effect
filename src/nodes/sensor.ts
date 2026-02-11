import {
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	type Cleanup,
	type ComputedOptions,
	defaultEquals,
	link,
	type StateNode,
	setState,
	TYPE_SENSOR,
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

/* === Exported Functions === */

/**
 * Creates a sensor that tracks external input and updates a state value as long as it is active.
 * Sensors get activated when they are first accessed by an effect and deactivated when they are
 * no longer watched. This lazy activation pattern ensures resources are only consumed when needed.
 *
 * @since 0.18.0
 * @template T - The type of value stored in the state
 * @param start - The callback function that starts the sensor and returns a cleanup function.
 * @param options - Optional options for the sensor.
 * @param options.value - Optional initial value. Avoids `UnsetSignalValueError` on first read
 *   before the start callback fires. Essential for the mutable-object observation pattern.
 * @param options.equals - Optional equality function. Defaults to `Object.is`. Use `SKIP_EQUALITY`
 *   for mutable objects where the reference stays the same but internal state changes.
 * @param options.guard - Optional type guard to validate values.
 * @returns A read-only sensor signal.
 *
 * @example Tracking external values
 * ```ts
 * const mousePos = createSensor<{ x: number; y: number }>((set) => {
 *   const handler = (e: MouseEvent) => {
 *     set({ x: e.clientX, y: e.clientY });
 *   };
 *   window.addEventListener('mousemove', handler);
 *   return () => window.removeEventListener('mousemove', handler);
 * });
 * ```
 *
 * @example Observing a mutable object
 * ```ts
 * import { createSensor, SKIP_EQUALITY } from 'cause-effect';
 *
 * const el = createSensor<HTMLElement>((set) => {
 *   const node = document.getElementById('box')!;
 *   set(node);
 *   const obs = new MutationObserver(() => set(node));
 *   obs.observe(node, { attributes: true });
 *   return () => obs.disconnect();
 * }, { value: node, equals: SKIP_EQUALITY });
 * ```
 */
function createSensor<T extends {}>(
	start: SensorCallback<T>,
	options?: ComputedOptions<T>,
): Sensor<T> {
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
						validateSignalValue(TYPE_SENSOR, next, node.guard)
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
 * @since 0.18.0
 * @param value - The value to check
 * @returns True if the value is a Sensor
 */
function isSensor<T extends {} = unknown & {}>(
	value: unknown,
): value is Sensor<T> {
	return isObjectOfType(value, TYPE_SENSOR)
}

export { createSensor, isSensor, type Sensor, type SensorCallback }
