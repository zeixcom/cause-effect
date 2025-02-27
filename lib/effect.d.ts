import { type Signal } from "./signal";
export type EffectOkCallback<T extends {}[]> = (...values: T) => void;
export type EffectCallbacks<T extends {}[]> = {
    ok: EffectOkCallback<T>;
    nil?: () => void;
    err?: (...errors: Error[]) => void;
};
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {() => void} ok - callback function to be executed when a state changes
 */
export declare function effect<T extends {}>(ok: EffectOkCallback<T[]>, ...signals: Signal<T>[]): void;
export declare function effect<T extends {}>(callbacks: EffectCallbacks<T[]>, ...signals: Signal<T>[]): void;
