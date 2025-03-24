
import { UNSET, type Signal } from './signal'
import { CircularDependencyError, toError } from './util'
import { watch } from './scheduler'

/* === Types === */

export type OkCallback<S extends Signal<{}>[]> = (...values: {
	[K in keyof S]: S[K] extends Signal<infer T> ? T : never
}) => void | (() => void)
export type NilCallback = () => void | (() => void)
export type ErrCallback = (...errors: Error[]) => void | (() => void)

export type TapMatcher<S extends Signal<{}>[]> = {
	ok: OkCallback<S>
	err: ErrCallback
	nil?: NilCallback
}

export type EffectMatcher<S extends Signal<{}>[]> = {
	signals: S
	ok: OkCallback<S>
	err: ErrCallback
	nil?: NilCallback
}

/* === Exported Functions === */

/**
 * Resolve signals and match callback based on the result
 * 
 * @since 0.13.0
 * @param { EffectMatcher<S extends Signal<{}>[]>} matcher - matcher object
 * @returns {CallbackReturnType<T>} - result of chosen callback
 */
const match = <S extends Signal<{}>[]>(matcher: EffectMatcher<S>): void | (() => void) => {
	const { signals, ok, err } = matcher
	const nil = matcher.nil || (() => {})

	const values = [] as { [K in keyof S]: S[K] extends Signal<infer T> ? T : never }
	const errors = []
	let suspense = false
	for (let i = 0; i < signals.length; i++) {
		const s = signals[i]
		try {
			const value = s.get()
			if (value === UNSET) suspense = true
			values[i] = value
		} catch (e) {
			errors.push(toError(e))
		}
	}

	let result: void | (() => void) = undefined
	try {
		result = suspense ? nil()
			: errors.length ? err(...errors)
			: ok(...values)
	} catch (e) {
		err(toError(e))
	}
	return result
}

/**
 * Define what happens when a reactive state changes
 * 
 * @since 0.1.0
 * @param {EffectMatcher<S>} matcher - effect callback or signal matcher object
 */
export function effect<S extends Signal<{}>[]>(
	matcher: EffectMatcher<S>,
): void | (() => void) {
	let running = false
	const run = () => watch(() => {
		if (running) throw new CircularDependencyError('effect')
		running = true
		match(matcher)
		running = false
    }, run)
	run()
}
