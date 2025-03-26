import { type Signal } from './signal';
export type OkCallback<S extends Signal<{}>[]> = (...values: {
    [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
}) => void | (() => void);
export type NilCallback = () => void | (() => void);
export type ErrCallback = (...errors: Error[]) => void | (() => void);
export type TapMatcher<T extends {}> = {
    ok: (v: T) => void | (() => void);
    err?: ErrCallback;
    nil?: NilCallback;
};
export type EffectMatcher<S extends Signal<{}>[]> = {
    signals: S;
    ok: OkCallback<S>;
    err?: ErrCallback;
    nil?: NilCallback;
};
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectMatcher<S> | (() => void | (() => void))} matcher - effect matcher or callback
 * @returns {() => void} - cleanup function for the effect
 */
export declare function effect<S extends Signal<{}>[]>(matcher: EffectMatcher<S> | (() => void | (() => void))): () => void;
