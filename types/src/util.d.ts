/**
 * @deprecated
 */
declare function isFunction<T>(fn: unknown): fn is (...args: unknown[]) => T;
/**
 * @deprecated
 */
declare function isAsyncFunction<T>(fn: unknown): fn is (...args: unknown[]) => Promise<T>;
/**
 * @deprecated
 */
declare function isSyncFunction<T extends unknown & {
    then?: undefined;
}>(fn: unknown): fn is (...args: unknown[]) => T;
/**
 * @deprecated Use `isSignalOfType()` for signal type guards.
 * This function allocates two strings per call and will be removed in a future release.
 */
declare function isObjectOfType<T>(value: unknown, type: string): value is T;
declare function isSignalOfType<T>(value: unknown, type: string): value is T;
/**
 * @deprecated
 */
declare function isRecord<T extends Record<string, unknown>>(value: unknown): value is T;
/**
 * @deprecated
 */
declare function isUniformArray<T>(value: unknown, guard?: (item: T) => item is T & {}): value is T[];
/**
 * @deprecated
 */
declare function valueString(value: unknown): string;
export { isFunction, isAsyncFunction, isSyncFunction, isObjectOfType, isSignalOfType, isRecord, isUniformArray, valueString, };
