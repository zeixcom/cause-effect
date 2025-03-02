import { type SignalValue, type UnknownSignal } from './signal';
export type EffectOkCallback<T extends UnknownSignal[]> = (...values: {
    [K in keyof T]: SignalValue<T[K]>;
}) => void;
export type EffectCallbacks<T extends UnknownSignal[]> = {
    ok: EffectOkCallback<T>;
    nil?: () => void;
    err?: (...errors: Error[]) => void;
};
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {() => void} callbacksOrFn - callback function to be executed when a state changes
 */
export declare function effect<T extends UnknownSignal[]>(callbacksOrFn: EffectCallbacks<T> | EffectOkCallback<T>, ...signals: T): void;
