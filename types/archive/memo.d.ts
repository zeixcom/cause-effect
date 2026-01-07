type Memo<T extends {}> = {
    readonly [Symbol.toStringTag]: 'Memo';
    get(): T;
};
type MemoCallback<T extends {} & {
    then?: undefined;
}> = (oldValue: T) => T;
declare const TYPE_MEMO: "Memo";
/**
 * Create a derived signal from existing signals
 *
 * @since 0.9.0
 * @param {MemoCallback<T>} callback - Computation callback function
 * @returns {Memo<T>} - Computed signal
 */
declare const createMemo: <T extends {}>(callback: MemoCallback<T>, initialValue?: T) => Memo<T>;
/**
 * Check if a value is a memoized signal
 *
 * @since 0.9.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a memo signal, false otherwise
 */
declare const isMemo: <T extends {}>(value: unknown) => value is Memo<T>;
/**
 * Check if the provided value is a callback that may be used as input for toSignal() to derive a computed state
 *
 * @since 0.12.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a sync callback, false otherwise
 */
declare const isMemoCallback: <T extends {} & {
    then?: undefined;
}>(value: unknown) => value is MemoCallback<T>;
export { TYPE_MEMO, createMemo, isMemo, isMemoCallback, type Memo, type MemoCallback, };
