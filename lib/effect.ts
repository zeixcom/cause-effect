
import { UNSET, type Signal } from './signal'
import { CircularDependencyError, toError } from './util'
import { watch, type Watcher } from './scheduler'

/* === Types === */

export type OkCallback<S extends Signal<{}>[]> = (...values: {
	[K in keyof S]: S[K] extends Signal<infer T> ? T : never
}) => void | (() => void)
export type NilCallback = () => void | (() => void)
export type ErrCallback = (...errors: Error[]) => void | (() => void)

export type TapMatcher<S extends Signal<{}>[]> = {
	ok: OkCallback<S>
	err?: ErrCallback
	nil?: NilCallback
}

export type EffectMatcher<S extends Signal<{}>[]> = {
	signals: S
	ok: OkCallback<S>
	err?: ErrCallback
	nil?: NilCallback
}

/* === Exported Functions === */

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {EffectMatcher<S>} matcher - effect callback or signal matcher object
 */
export function effect<S extends Signal<{}>[]>({
	signals,
	ok,
	err = console.error,
	nil = () => {}
}: EffectMatcher<S>): () => void {
	let running = false
	const run = (() => watch(() => {
		if (running) throw new CircularDependencyError('effect')
		running = true
		const errors: Error[] = []
		let suspense = false
		const values = signals.map(signal => {
			try {
				const value = signal.get()
				if (value === UNSET) suspense = true
				return value
			} catch (e) {
				errors.push(toError(e))
			}
		})
		try {
			suspense ? nil()
				: errors.length ? err(...errors)
				: ok(...values as {
					[K in keyof S]: S[K] extends Signal<infer T> ? T : never
				})
		} catch (e) {
			err(toError(e))
		}
		running = false
    }, run)) as Watcher
	run.cleanups = new Set()
	run()
	return () => {
		run.cleanups.forEach((fn: () => void) => fn())
		run.cleanups.clear()
	}
}