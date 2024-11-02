import { type Enqueue } from "./scheduler";
type EffectCallback = (enqueue: Enqueue) => void | (() => void);
/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectCallback} fn - callback function to be executed when a state changes
 */
export declare const effect: (fn: EffectCallback) => void;
export {};
