type UnknownRecord = Record<string, unknown & {}>;
type UnknownArray = ReadonlyArray<unknown & {}>;
type ArrayToRecord<T extends UnknownRecord | UnknownArray> = T extends UnknownArray ? {
    [key: string]: T extends Array<infer U extends {}> ? U : never;
} : T extends UnknownRecord ? T : never;
type PartialRecord<T> = T extends UnknownArray ? Partial<ArrayToRecord<T>> : Partial<T>;
type DiffResult<T extends UnknownRecord | UnknownArray = UnknownRecord> = {
    changed: boolean;
    add: PartialRecord<T>;
    change: PartialRecord<T>;
    remove: PartialRecord<T>;
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
declare const diff: <T extends UnknownRecord | UnknownArray>(oldObj: T extends UnknownArray ? ArrayToRecord<T> : T, newObj: T extends UnknownArray ? ArrayToRecord<T> : T) => DiffResult<T>;
export { type ArrayToRecord, type DiffResult, diff, isEqual, type UnknownRecord, type UnknownArray, type PartialRecord, };
