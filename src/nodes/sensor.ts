import {
	validateCallback,
	validateReadValue,
	validateSignalValue,
} from '../errors'
import {
	activeSink,
	type Cleanup,
	DEFAULT_EQUALITY,
	link,
	type Signal,
	type SignalOptions,
	type StateNode,
	setState,
	TYPE_SIGNAL,
} from '../graph'
import { isSyncFunction } from '../util'

/* === Types === */

/**
 * Configuration options for `createSensor`.
 *
 * @template T - The type of value produced by the sensor
 */
type SensorOptions<T extends {}> = SignalOptions<T> & {
	/**
	 * Optional initial value. Avoids `UnsetSignalValueError` on first read
	 * before the watched callback fires.
	 */
	value?: T
}

/**
 * Setup callback for `createSensor`. Runs when the sensor becomes watched.
 * Receives a `set` function to push new values into the graph.
 *
 * @template T - The type of value produced by the sensor
 * @param set - Updates the sensor value and propagates the change to its sinks
 * @returns A cleanup function that runs when the sensor is no longer watched
 */
type SensorCallback<T extends {}> = (set: (next: T) => void) => Cleanup

const WHERE = 'createSensor'

/* === Exported Functions === */

/**
 * Creates a sensor that tracks external input while it is watched.
 *
 * A sensor activates when an effect first reads it, and deactivates when it is no longer
 * watched. It therefore holds an external resource only while something reads its value.
 * The shape this factory returns is `Signal<T>` — the single-value, readonly member of the
 * shape-indexed value-type set. See ADR-0018.
 *
 * @since 0.18.0
 * @template T - The type of value produced by the sensor
 * @param watched - The callback that runs when the sensor becomes watched. Receives a `set` function and returns a cleanup function.
 * @param options - Optional configuration for the sensor.
 * @param options.value - Optional initial value. Avoids `UnsetSignalValueError` on first read
 *   before the watched callback fires. Essential for the mutable-object observation pattern.
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`). Use `SKIP_EQUALITY`
 *   for mutable objects where the reference stays the same but internal state changes.
 * @param options.guard - Optional type guard to validate values.
 * @returns A read-only sensor signal.
 *
 * @example Tracking external values
 * ```ts
 * // An initial `value` avoids UnsetSignalValueError on the first read,
 * // before any mousemove event has fired.
 * const mousePos = createSensor<{ x: number; y: number }>((set) => {
 *   const handler = (e: MouseEvent) => {
 *     set({ x: e.clientX, y: e.clientY });
 *   };
 *   window.addEventListener('mousemove', handler);
 *   return () => window.removeEventListener('mousemove', handler);
 * }, { value: { x: 0, y: 0 } });
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
	watched: SensorCallback<T>,
	options?: SensorOptions<T>,
): Signal<T> {
	validateCallback(WHERE, watched, isSyncFunction)
	if (options?.value !== undefined)
		validateSignalValue(WHERE, options.value, options?.guard)

	const node: StateNode<T> = {
		value: options?.value as T,
		sinks: null,
		sinksTail: null,
		equals: options?.equals ?? DEFAULT_EQUALITY,
		guard: options?.guard,
		stop: undefined,
	}

	return {
		[Symbol.toStringTag]: TYPE_SIGNAL,
		get(): T {
			if (activeSink) {
				if (!node.sinks)
					node.stop = watched((next: T): void => {
						validateSignalValue(WHERE, next, node.guard)
						setState(node, next)
					})
				link(node, activeSink)
			}
			validateReadValue(WHERE, node.value)
			return node.value
		},
	}
}

export { createSensor, type SensorCallback, type SensorOptions }
