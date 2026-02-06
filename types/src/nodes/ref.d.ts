import { type Cleanup } from '../graph';
import type { Memo } from './memo';
/**
 * A callback function for refs when the reference starts being watched.
 *
 * @param notify - A function to notify subscribers when the reference has updates
 * @returns A cleanup function when the reference stops being watched
 */
type RefCallback = (notify: () => void) => Cleanup;
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
declare const createRef: <T extends {}>(value: T, start: RefCallback) => Memo<T>;
export { createRef, type RefCallback };
