import { type Signal, UNSET } from './signal'
import {
	CircularDependencyError,
	isFunction,
	toError,
	isAbortError,
} from './util'
import { watch, type Cleanup, type Watcher } from './scheduler'

/* === Types === */

type TapMatcher<T extends {}> = {
	ok: (value: T) => void | Cleanup
	err?: (error: Error) => void | Cleanup
	nil?: () => void | Cleanup
}

type EffectMatcher<S extends Signal<{}>[]> = {
	signals: S
	ok: (
		...values: {
			[K in keyof S]: S[K] extends Signal<infer T> ? T : never
		}
	) => void | Cleanup
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
	const run = (() =>
		watch(() => {
			if (running) throw new CircularDependencyError('effect')
			running = true
			let cleanup: void | Cleanup = undefined
			try {
				const errors: Error[] = []
				let suspense = false
				const values = signals.map(signal => {
					try {
						const value = signal.get()
						if (value === UNSET) suspense = true
						return value
					} catch (e) {
						if (isAbortError(e)) throw e
						errors.push(toError(e))
						return UNSET
					}
				}) as {
					[K in keyof S]: S[K] extends Signal<infer T extends {}>
						? T
						: never
				}

				try {
					cleanup = suspense
						? nil()
						: errors.length
							? err(...errors)
							: ok(...values)
				} catch (e) {
					if (isAbortError(e)) throw e
					const error = toError(e)
					cleanup = err(error)
				}
			} catch (e) {
				err(toError(e))
			}
			if (isFunction(cleanup)) run.cleanups.add(cleanup)
			running = false
		}, run)) as Watcher
	run.cleanups = new Set<Cleanup>()
	run()
	return () => {
		run.cleanups.forEach(fn => fn())
		run.cleanups.clear()
	}
}

/* === Exports === */

export { type TapMatcher, type EffectMatcher, effect }
