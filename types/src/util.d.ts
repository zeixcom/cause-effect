declare const UNSET: any;
declare const isString: (value: unknown) => value is string;
declare const isNumber: (value: unknown) => value is number;
declare const isSymbol: (value: unknown) => value is symbol;
declare const isFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => T;
declare const isAsyncFunction: <T>(fn: unknown) => fn is (...args: unknown[]) => Promise<T>;
declare const isObjectOfType: <T>(value: unknown, type: string) => value is T;
declare const isRecord: <T extends Record<string, unknown>>(value: unknown) => value is T;
declare const isRecordOrArray: <T extends Record<string | number, unknown> | ReadonlyArray<unknown>>(value: unknown) => value is T;
declare const hasMethod: <T extends object & Record<string, (...args: unknown[]) => unknown>>(obj: T, methodName: string) => obj is T & Record<string, (...args: unknown[]) => unknown>;
declare const isAbortError: (error: unknown) => boolean;
<<<<<<< Updated upstream
declare const toError: (reason: unknown) => Error;
declare const arrayToRecord: <T>(array: T[]) => Record<string, T>;
declare const recordToArray: <T>(record: Record<string | number, T>) => Record<string, T> | T[];
declare const valueString: (value: unknown) => string;
export { UNSET, isString, isNumber, isSymbol, isFunction, isAsyncFunction, isObjectOfType, isRecord, isRecordOrArray, hasMethod, isAbortError, toError, arrayToRecord, recordToArray, valueString, };
=======
declare const valueString: (value: unknown) => string;
export { UNSET, isString, isNumber, isSymbol, isFunction, isAsyncFunction, isSyncFunction, isNonNullObject, isObjectOfType, isRecord, isRecordOrArray, isUniformArray, hasMethod, isAbortError, valueString, };
>>>>>>> Stashed changes
