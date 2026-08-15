import { type SignalCallback, type SignalOptions } from '../graph';
import type { Signal } from './signal';
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
 * @param options - Configuration for the sensor.
 * @param options.watched - The callback that runs when the sensor becomes watched. Receives an `emit` function and returns a cleanup function.
 * @param options.initial - Optional initial value. Avoids `UnsetSignalValueError` on first read
 *   before the watched callback fires. Essential for the mutable-object observation pattern.
 * @param options.equals - Optional equality function. Defaults to strict equality (`===`). Use `SKIP_EQUALITY`
 *   for mutable objects where the reference stays the same but internal state changes.
 * @param options.guard - Optional type guard to validate values.
 * @returns A read-only sensor signal.
 *
 * @example Tracking external values
 * ```ts
 * // An initial value avoids UnsetSignalValueError on the first read,
 * // before any mousemove event has fired.
 * const mousePos = createSensor<{ x: number; y: number }>({
 *   watched: (emit) => {
 *     const handler = (e: MouseEvent) => {
 *       emit({ x: e.clientX, y: e.clientY });
 *     };
 *     window.addEventListener('mousemove', handler);
 *     return () => window.removeEventListener('mousemove', handler);
 *   },
 *   initial: { x: 0, y: 0 },
 * });
 * ```
 *
 * @example Observing a mutable object
 * ```ts
 * import { createSensor, SKIP_EQUALITY } from 'cause-effect';
 *
 * const el = createSensor<HTMLElement>({
 *   watched: (emit) => {
 *     const node = document.getElementById('box')!;
 *     emit(node);
 *     const obs = new MutationObserver(() => emit(node));
 *     obs.observe(node, { attributes: true });
 *     return () => obs.disconnect();
 *   },
 *   initial: node,
 *   equals: SKIP_EQUALITY,
 * });
 * ```
 */
declare function createSensor<T extends {}>(options: SignalOptions<T> & {
    initial?: T;
} & {
    watched: SignalCallback<T>;
}): Signal<T>;
export { createSensor, type SignalCallback };
