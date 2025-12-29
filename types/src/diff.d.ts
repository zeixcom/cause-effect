type UnknownRecord = Record<string, unknown>;
type UnknownArray = ReadonlyArray<unknown & {}>;
type DiffResult = {
    changed: boolean;
    add: UnknownRecord;
    change: UnknownRecord;
    remove: UnknownRecord;
};
/**
 * Checks if two values are equal with cycle detection
 *
 * @since 0.15.0
 * @param {T} a - First value to compare
 * @param {T} b - Second value to compare
 * @param {WeakSet<object>} visited - Set to track visited objects for cycle detection
 * @returns {boolean} Whether the two values are equal
 */
declare const isEqual: <T>(a: T, b: T, visited?: WeakSet<object>) => boolean;
/**
 * Compares two records and returns a result object containing the differences.
 *
 * @since 0.15.0
 * @param {T} oldObj - The old record to compare
 * @param {T} newObj - The new record to compare
 * @returns {DiffResult} The result of the comparison
 */
declare const diff: <T extends UnknownRecord>(oldObj: T, newObj: T) => DiffResult;
export { type DiffResult, diff, isEqual, type UnknownRecord, type UnknownArray };
