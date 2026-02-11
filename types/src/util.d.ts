declare function isFunction<T>(fn: unknown): fn is (...args: unknown[]) => T;
declare function isAsyncFunction<T>(fn: unknown): fn is (...args: unknown[]) => Promise<T>;
declare function isSyncFunction<T extends unknown & {
    then?: undefined;
}>(fn: unknown): fn is (...args: unknown[]) => T;
declare function isObjectOfType<T>(value: unknown, type: string): value is T;
declare function isRecord<T extends Record<string, unknown>>(value: unknown): value is T;
declare function isUniformArray<T>(value: unknown, guard?: (item: T) => item is T & {}): value is T[];
declare function valueString(value: unknown): string;
export { isFunction, isAsyncFunction, isSyncFunction, isObjectOfType, isRecord, isUniformArray, valueString, };
