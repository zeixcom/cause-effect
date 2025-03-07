
import { type EffectCallbacks, type Signal, resolve } from './signal'
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
export function effect<U extends Signal<{}>[]>(
	cb: EffectCallbacks<U>,
	...maybeSignals: U
): void {
	let running = false
	const run = () => watch(() => {
		if (running) throw new Error('Circular dependency in effect detected')
		running = true
		const result = resolve(maybeSignals, cb)
		if (isError(result))
			console.error('Unhandled error in effect:', result)
		running = false
    }, run)
	run()
}
