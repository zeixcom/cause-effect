import { type Signal, match } from './signal'
import { CircularDependencyError, isFunction, toError } from './util'
import { watch, type Watcher } from './scheduler'

/* === Types === */

export type TapMatcher<T extends {}> = {
	ok: (value: T) => void | (() => void)
	err?: (error: Error) => void | (() => void)
	nil?: () => void | (() => void)
}

export type EffectMatcher<S extends Signal<{}>[]> = {
	signals: S
	ok: (
		...values: {
			[K in keyof S]: S[K] extends Signal<infer T> ? T : never
		}
	) => void | (() => void)
	err?: (...errors: Error[]) => void | (() => void)
	nil?: () => void | (() => void)
}

/* === Exported Functions === */

/**
 * Define what happens when a reactive state changes
 *
 * @since 0.1.0
 * @param {EffectMatcher<S> | (() => void | (() => void))} matcher - effect matcher or callback
 * @returns {() => void} - cleanup function for the effect
 */
export function effect<S extends Signal<{}>[]>(
	matcher: EffectMatcher<S> | (() => void | (() => void)),
): () => void {
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
			let cleanup: void | (() => void) = undefined
			try {
				cleanup = match<S, void | (() => void)>({
					signals,
					ok,
					err,
					nil,
				}) as void | (() => void)
			} catch (e) {
				err(toError(e))
			}
			if (isFunction(cleanup)) run.cleanups.add(cleanup)
			running = false
		}, run)) as Watcher
	run.cleanups = new Set()
	run()
	return () => {
		run.cleanups.forEach((fn: () => void) => fn())
		run.cleanups.clear()
	}
}
