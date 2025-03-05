import { type EffectCallbacks, type MaybeSignal } from './signal';
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {() => void} cb - effect callback or object of ok, nil, err callbacks to be executed when a state changes
 * @param {U} maybeSignals - signals of functions using signals that should trigger the effect
 */
export declare function effect<U extends MaybeSignal<{}>[]>(cb: EffectCallbacks<U>, ...maybeSignals: U): void;
