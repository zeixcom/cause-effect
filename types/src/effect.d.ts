import { type Cleanup } from './scheduler';
import { type Signal, type SignalValues } from './signal';
type EffectMatcher<S extends Signal<unknown & {}>[]> = {
    signals: S;
    ok: (...values: SignalValues<S>) => Cleanup | undefined;
    err?: (...errors: Error[]) => Cleanup | undefined;
    nil?: () => Cleanup | undefined;
};
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectMatcher<S> | (() => Cleanup | undefined)} matcher - effect matcher or callback
 * @returns {Cleanup} - cleanup function for the effect
 */
declare function effect<S extends Signal<unknown & {}>[]>(matcher: EffectMatcher<S> | (() => Cleanup | undefined)): Cleanup;
export { type EffectMatcher, effect };
