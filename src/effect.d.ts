import { type Signal, type SignalValues } from './signal';
import { type Cleanup } from './scheduler';
type EffectMatcher<S extends Signal<{}>[]> = {
    signals: S;
    ok: (...values: SignalValues<S>) => void | Cleanup;
    err?: (...errors: Error[]) => void | Cleanup;
    nil?: () => void | Cleanup;
};
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectMatcher<S> | (() => void | Cleanup)} matcher - effect matcher or callback
 * @returns {Cleanup} - cleanup function for the effect
 */
declare function effect<S extends Signal<{}>[]>(matcher: EffectMatcher<S> | (() => void | Cleanup)): Cleanup;
export { type EffectMatcher, effect };
