
import { type EffectCallbacks, type MaybeSignal, resolve } from './signal'
import { isError } from './util'
import { watch } from './scheduler'

/* === Exported Function === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {() => void} cb - effect callback or object of ok, nil, err callbacks to be executed when a state changes
 * @param {U} maybeSignals - signals of functions using signals that should trigger the effect
 */
export function effect<U extends MaybeSignal<{}>[]>(
	cb: EffectCallbacks<U>,
	...maybeSignals: U
): void {
	const run = () => watch(() => {
		const result = resolve(maybeSignals, cb)
		if (isError(result))
			console.error('Unhandled error in effect:', result)
    }, run)
	run()
}
