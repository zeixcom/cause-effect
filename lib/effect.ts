
import { resolveSignals, type SignalValue, type UnknownSignal } from './signal'
import { isError, isFunction } from './util'
import { watch } from './scheduler'

/* === Types === */

export type EffectOkCallback<T extends UnknownSignal[]> = (
	...values: { [K in keyof T]: SignalValue<T[K]> }
) => void

export type EffectCallbacks<T extends UnknownSignal[]> = {
	ok: EffectOkCallback<T>
	nil?: () => void
	err?: (...errors: Error[]) => void
}

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {() => void} callbacksOrFn - callback function to be executed when a state changes
 */
export function effect<T extends UnknownSignal[]>(
	callbacksOrFn: EffectCallbacks<T> | EffectOkCallback<T>,
	...signals: T
): void {
	const callbacks = isFunction(callbacksOrFn)
        ? { ok: callbacksOrFn }
        : callbacksOrFn as EffectCallbacks<T>

	const run = () => watch(() => {
		const result = resolveSignals(signals, callbacks)
		if (isError(result))
			throw new Error('Unhandled error in effect:', { cause: result })
    }, run)
	run()
}
