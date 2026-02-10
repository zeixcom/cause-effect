import { isFunction, valueString } from './util'

/* === Types === */

/**
 * A type guard function that validates whether an unknown value is of type T.
 * Used to ensure type safety when updating signals.
 *
 * @template T - The type to guard against
 * @param value - The value to check
 * @returns True if the value is of type T
 */
type Guard<T extends {}> = (value: unknown) => value is T

/* === Error Classes === */

/**
 * Error thrown on re-entrance on an already running function.
 */
class CircularDependencyError extends Error {
	/**
	 * Constructs a new CircularDependencyError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Circular dependency detected`)
		this.name = 'CircularDependencyError'
	}
}

/**
 * Error thrown when a signal value is null or undefined.
 */
class NullishSignalValueError extends TypeError {
	/**
	 * Constructs a new NullishSignalValueError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Signal value cannot be null or undefined`)
		this.name = 'NullishSignalValueError'
	}
}

/**
 * Error thrown when a signal is read before it has a value.
 */
class UnsetSignalValueError extends Error {
	/**
	 * Constructs a new UnsetSignalValueError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Signal value is unset`)
		this.name = 'UnsetSignalValueError'
	}
}

/**
 * Error thrown when a signal value is invalid.
 */
class InvalidSignalValueError extends TypeError {
	/**
	 * Constructs a new InvalidSignalValueError.
	 *
	 * @param where - The location where the error occurred.
	 * @param value - The invalid value.
	 */
	constructor(where: string, value: unknown) {
		super(`[${where}] Signal value ${valueString(value)} is invalid`)
		this.name = 'InvalidSignalValueError'
	}
}

/**
 * Error thrown when a callback is invalid.
 */
class InvalidCallbackError extends TypeError {
	/**
	 * Constructs a new InvalidCallbackError.
	 *
	 * @param where - The location where the error occurred.
	 * @param value - The invalid value.
	 */
	constructor(where: string, value: unknown) {
		super(`[${where}] Callback ${valueString(value)} is invalid`)
		this.name = 'InvalidCallbackError'
	}
}

/**
 * Error thrown when an API requiring an owner is called without one.
 */
class RequiredOwnerError extends Error {
	/**
	 * Constructs a new RequiredOwnerError.
	 *
	 * @param where - The location where the error occurred.
	 */
	constructor(where: string) {
		super(`[${where}] Active owner is required`)
		this.name = 'RequiredOwnerError'
	}
}

class DuplicateKeyError extends Error {
	constructor(where: string, key: string, value?: unknown) {
		super(
			`[${where}] Could not add key "${key}"${
				value ? ` with value ${JSON.stringify(value)}` : ''
			} because it already exists`,
		)
		this.name = 'DuplicateKeyError'
	}
}

/* === Validation Functions === */

function validateSignalValue<T extends {}>(
	where: string,
	value: unknown,
	guard?: Guard<T>,
): asserts value is T {
	if (value == null) throw new NullishSignalValueError(where)
	if (guard && !guard(value)) throw new InvalidSignalValueError(where, value)
}

function validateReadValue<T extends {}>(
	where: string,
	value: T | null | undefined,
): asserts value is T {
	if (value == null) throw new UnsetSignalValueError(where)
}

function validateCallback(
	where: string,
	value: unknown,
): asserts value is (...args: unknown[]) => unknown
function validateCallback<T>(
	where: string,
	value: unknown,
	guard: (value: unknown) => value is T,
): asserts value is T
function validateCallback(
	where: string,
	value: unknown,
	guard: (value: unknown) => boolean = isFunction,
): void {
	if (!guard(value)) throw new InvalidCallbackError(where, value)
}

export {
	type Guard,
	CircularDependencyError,
	NullishSignalValueError,
	InvalidSignalValueError,
	UnsetSignalValueError,
	InvalidCallbackError,
	RequiredOwnerError,
	DuplicateKeyError,
	validateSignalValue,
	validateReadValue,
	validateCallback,
}
