import type { UnknownRecord } from './diff'
import { type SignalValues, UNSET, type UnknownSignalRecord } from './signal'
import { toError } from './util'

/* === Types === */

type ResolveResult<S extends UnknownSignalRecord> =
	| { ok: true; values: SignalValues<S>; errors?: never; pending?: never }
	| { ok: false; errors: readonly Error[]; values?: never; pending?: never }
	| { ok: false; pending: true; values?: never; errors?: never }

/* === Functions === */

/**
 * Resolve signal values with perfect type inference
 *
 * Always returns a discriminated union result, regardless of whether
 * handlers are provided or not. This ensures a predictable API.
 *
 * @since 0.15.0
 * @param {S} signals - Signals to resolve
 * @returns {ResolveResult<S>} - Discriminated union result
 */
function resolve<S extends UnknownSignalRecord>(signals: S): ResolveResult<S> {
	const errors: Error[] = []
	let pending = false
	const values: UnknownRecord = {}

	// Collect values and errors
	for (const [key, signal] of Object.entries(signals)) {
		try {
			const value = signal.get()
			if (value === UNSET) pending = true
			else values[key] = value
		} catch (e) {
			errors.push(toError(e))
		}
	}

	// Return discriminated union
	if (pending) return { ok: false, pending: true }
	if (errors.length > 0) return { ok: false, errors }
	return { ok: true, values: values as SignalValues<S> }
}

/* === Exports === */

export { resolve, type ResolveResult }
