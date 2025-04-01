import { type Signal } from './signal';
export type TapMatcher<T extends {}> = {
    ok: (value: T) => void | (() => void);
    err?: (error: Error) => void | (() => void);
    nil?: () => void | (() => void);
};
export type EffectMatcher<S extends Signal<{}>[]> = {
    signals: S;
    ok: (...values: {
        [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
    }) => void | (() => void);
    err?: (...errors: Error[]) => void | (() => void);
    nil?: () => void | (() => void);
};
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectMatcher<S> | (() => void | (() => void))} matcher - effect matcher or callback
 * @returns {() => void} - cleanup function for the effect
 */
export declare function effect<S extends Signal<{}>[]>(matcher: EffectMatcher<S> | (() => void | (() => void))): () => void;
