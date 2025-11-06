import type { ResolveResult } from './resolve'
import type { SignalValues, UnknownSignalRecord } from './signal'
import { toError } from './util'

/* === Types === */

type MatchHandlers<S extends UnknownSignalRecord> = {
	ok: (values: SignalValues<S>) => void
	err?: (errors: readonly Error[]) => void
	nil?: () => void
}

/* === Functions === */

/**
 * Match on resolve result and call appropriate handler for side effects
 *
 * This is a utility function for those who prefer the handler pattern.
 * All handlers are for side effects only and return void. If you need
 * cleanup logic, use a hoisted let variable in your effect.
 *
 * @since 0.15.0
 * @param {ResolveResult<S>} result - Result from resolve()
 * @param {MatchHandlers<S>} handlers - Handlers for different states (side effects only)
 * @returns {void} - Always returns void
 */
function match<S extends UnknownSignalRecord>(
	result: ResolveResult<S>,
	handlers: MatchHandlers<S>,
): void {
	try {
		if (result.pending) handlers.nil?.()
		else if (result.errors) handlers.err?.(result.errors)
		else if (result.ok) handlers.ok(result.values)
	} catch (error) {
		// If handler throws, try error handler, otherwise rethrow
		if (
			handlers.err &&
			(!result.errors || !result.errors.includes(toError(error)))
		)
			handlers.err(
				result.errors
					? [...result.errors, toError(error)]
					: [toError(error)],
			)
		else throw error
	}
}

/* === Exports === */

export { match, type MatchHandlers }
