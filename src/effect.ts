import { type Signal, type SignalValues, UNSET } from './signal'
import { CircularDependencyError, isFunction, toError } from './util'
import { type Cleanup, watch, observe } from './scheduler'

/* === Types === */

type EffectMatcher<S extends Signal<{}>[]> = {
	signals: S
	ok: (...values: SignalValues<S>) => void | Cleanup
	err?: (...errors: Error[]) => void | Cleanup
	nil?: () => void | Cleanup
}

/* === Functions === */

/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectMatcher<S> | (() => void | Cleanup)} matcher - effect matcher or callback
 * @returns {Cleanup} - cleanup function for the effect
 */
function effect<S extends Signal<{}>[]>(
	matcher: EffectMatcher<S> | (() => void | Cleanup),
): Cleanup {
	const {
		signals,
		ok,
		err = console.error,
		nil = () => {},
	} = isFunction(matcher)
		? { signals: [] as unknown as S, ok: matcher }
		: matcher

	let running = false
	const run = watch(() =>
		observe(() => {
			if (running) throw new CircularDependencyError('effect')
			running = true

			// Pure part
			const errors: Error[] = []
			let pending = false
			const values = signals.map(signal => {
				try {
					const value = signal.get()
					if (value === UNSET) pending = true
					return value
				} catch (e) {
					errors.push(toError(e))
					return UNSET
				}
			}) as SignalValues<S>

			// Effectful part
			let cleanup: void | Cleanup = undefined
			try {
				cleanup = pending
					? nil()
					: errors.length
						? err(...errors)
						: ok(...values)
			} catch (e) {
				cleanup = err(toError(e))
			} finally {
				if (isFunction(cleanup)) run.off(cleanup)
			}

			running = false
		}, run),
	)
	run()
	return () => run.cleanup()
}

/* === Exports === */

export { type EffectMatcher, effect }
