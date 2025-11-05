import { type SignalValues, type UnknownSignalRecord } from './signal';
type ResolveResult<S extends UnknownSignalRecord> = {
    ok: true;
    values: SignalValues<S>;
    errors?: never;
    pending?: never;
} | {
    ok: false;
    errors: readonly Error[];
    values?: never;
    pending?: never;
} | {
    ok: false;
    pending: true;
    values?: never;
    errors?: never;
};
/**
 * Resolve signal values with perfect type inference
 *
 * Always returns a discriminated union result, regardless of whether
 * handlers are provided or not. This ensures a predictable API.
 *
 * @since 0.15.0
 * @param {S} signals - Signals to resolve
 * @returns {ResolveResult<S>} - Discriminated union result
 */
declare function resolve<S extends UnknownSignalRecord>(signals: S): ResolveResult<S>;
export { resolve, type ResolveResult };
