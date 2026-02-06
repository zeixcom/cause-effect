import { type Cleanup, type SignalOptions } from '../graph';
import type { Memo } from './memo';
/**
 * A callback function for sensors when the sensor starts being watched.
 *
 * @template T - The type of value observed
 * @param set - A function to set the observed value
 * @returns A cleanup function when the sensor stops being watched
 */
type SensorCallback<T extends {}> = (set: (next: T) => void) => Cleanup;
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
declare const createSensor: <T extends {}>(start: SensorCallback<T>, options?: SignalOptions<T>) => Memo<T>;
export { createSensor, type SensorCallback };
