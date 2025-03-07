import { type EffectCallbacks, type Signal } from './signal';
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {() => void} cb - effect callback or object of ok, nil, err callbacks to be executed when a state changes
 * @param {U} signals - signals that should trigger the effect
 */
export declare function effect<U extends Signal<{}>[]>(cb: EffectCallbacks<U>, ...signals: U): void;
