import { type Cleanup, observe, watch } from './scheduler'
import { type Signal, type SignalValues, UNSET } from './signal'
import { CircularDependencyError, isFunction, toError } from './util'

/* === Types === */

type EffectMatcher<S extends Signal<unknown & {}>[]> = {
	signals: S
	ok: (...values: SignalValues<S>) => Cleanup | undefined
	err?: (...errors: Error[]) => Cleanup | undefined
	nil?: () => Cleanup | undefined
}

/* === Functions === */

/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectMatcher<S> | (() => Cleanup | undefined)} matcher - effect matcher or callback
 * @returns {Cleanup} - cleanup function for the effect
 */
function effect<S extends Signal<unknown & {}>[]>(
	matcher: EffectMatcher<S> | (() => Cleanup | undefined),
): Cleanup {
	const {
		signals,
		ok,
		err = (error: Error): undefined => {
			console.error(error)
		},
		nil = (): undefined => {},
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
			let cleanup: Cleanup | undefined
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
