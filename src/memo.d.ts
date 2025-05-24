import { type Computed } from './computed';
type MemoCallback<T extends {} & {
    then?: void;
}> = () => T;
/**
 * Create a derived signal for synchronous computations
 *
 * @since 0.14.0
 * @param {MemoCallback<T>} fn - synchronous computation callback
 * @returns {Computed<T>} - Computed signal
 */
declare const memo: <T extends {}>(fn: MemoCallback<T>) => Computed<T>;
export { type MemoCallback, memo };
