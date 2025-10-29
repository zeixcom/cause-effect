import type { ResolveResult } from './resolve';
import type { Signal, SignalValues } from './signal';
type MatchHandlers<S extends Record<string, Signal<unknown & {}>>> = {
    ok?: (values: SignalValues<S>) => void;
    err?: (errors: readonly Error[]) => void;
    nil?: () => void;
};
/**
 * Match on resolve result and call appropriate handler for side effects
 *
 * This is a utility function for those who prefer the handler pattern.
 * All handlers are for side effects only and return void. If you need
 * cleanup logic, use a hoisted let variable in your effect.
 *
 * @since 0.15.0
 * @param {ResolveResult<S>} result - Result from resolve()
 * @param {MatchHandlers<S>} handlers - Handlers for different states (side effects only)
 * @returns {void} - Always returns void
 */
declare function match<S extends Record<string, Signal<unknown & {}>>>(result: ResolveResult<S>, handlers: MatchHandlers<S>): void;
export { match, type MatchHandlers };
