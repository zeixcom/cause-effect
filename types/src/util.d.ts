declare function isFunction<T>(fn: unknown): fn is (...args: unknown[]) => T;
declare function isAsyncFunction<T>(fn: unknown): fn is (...args: unknown[]) => Promise<T>;
declare function isSyncFunction<T extends unknown & {
    then?: undefined;
}>(fn: unknown): fn is (...args: unknown[]) => T;
declare function isSignalOfType<T>(value: unknown, type: string): value is T;
declare function isRecord<T extends Record<string, unknown>>(value: unknown): value is T;
/**
 * @deprecated
 */
declare function valueString(value: unknown): string;
export { isAsyncFunction, isFunction, isRecord, isSignalOfType, isSyncFunction, valueString, };
