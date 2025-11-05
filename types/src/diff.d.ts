type UnknownRecord = Record<string, unknown & {}>;
type UnknownRecordOrArray = {
    [x: string | number]: unknown & {};
};
type DiffResult<T extends UnknownRecordOrArray = UnknownRecord> = {
    changed: boolean;
    add: Partial<T>;
    change: Partial<T>;
    remove: Partial<T>;
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
 * @returns {DiffResult<T>} The result of the comparison
 */
declare const diff: <T extends UnknownRecordOrArray>(oldObj: T, newObj: T) => DiffResult<T>;
export { type DiffResult, diff, isEqual, type UnknownRecord, type UnknownRecordOrArray, };
