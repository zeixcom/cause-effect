import { isFunction, isSymbol, valueString } from '../src/util'
import { isMutableSignal, type MutableSignal } from './signal'
import { UNSET } from './system'

/* === Types === */

type Guard<T> = (value: unknown) => value is T

/* === Classes === */

class CircularDependencyError extends Error {
	constructor(where: string) {
		super(`Circular dependency detected in ${where}`)
		this.name = 'CircularDependencyError'
	}
}

class DuplicateKeyError extends Error {
	constructor(where: string, key: string, value?: unknown) {
		super(
			`Could not add ${where} key "${key}"${
				value ? ` with value ${valueString(value)}` : ''
			} because it already exists`,
		)
		this.name = 'DuplicateKeyError'
	}
}

class FailedAssertionError extends Error {
	constructor(message: string = 'unexpected condition') {
		super(`Assertion failed: ${message}`)
		this.name = 'FailedAssertionError'
	}
}

class InvalidCallbackError extends TypeError {
	constructor(where: string, value: unknown) {
		super(`Invalid ${where} callback ${valueString(value)}`)
		this.name = 'InvalidCallbackError'
	}
}

class InvalidCollectionSourceError extends TypeError {
	constructor(where: string, value: unknown) {
		super(`Invalid ${where} source ${valueString(value)}`)
		this.name = 'InvalidCollectionSourceError'
	}
}

class InvalidSignalValueError extends TypeError {
	constructor(where: string, value: unknown) {
		super(`Invalid signal value ${valueString(value)} in ${where}`)
		this.name = 'InvalidSignalValueError'
	}
}

class NullishSignalValueError extends TypeError {
	constructor(where: string) {
		super(`Nullish signal values are not allowed in ${where}`)
		this.name = 'NullishSignalValueError'
	}
}

class ReadonlySignalError extends Error {
	constructor(what: string, value: unknown) {
		super(
			`Could not set ${what} to ${valueString(value)} because signal is read-only`,
		)
		this.name = 'ReadonlySignalError'
	}
}

/* === Functions === */

function assert(condition: unknown, msg?: string): asserts condition {
	if (!condition) throw new FailedAssertionError(msg)
}

const createError = /*#__PURE__*/ (reason: unknown): Error =>
	reason instanceof Error ? reason : Error(String(reason))

const validateCallback = (
	where: string,
	value: unknown,
	guard: (value: unknown) => boolean = isFunction,
): void => {
	if (!guard(value)) throw new InvalidCallbackError(where, value)
}

const validateSignalValue = (
	where: string,
	value: unknown,
	guard: (value: unknown) => boolean = () =>
		!(isSymbol(value) && value !== UNSET) || isFunction(value),
): void => {
	if (value == null) throw new NullishSignalValueError(where)
	if (!guard(value)) throw new InvalidSignalValueError(where, value)
}

const guardMutableSignal = <T extends {}>(
	what: string,
	value: unknown,
	signal: unknown,
): signal is MutableSignal<T> => {
	if (!isMutableSignal(signal)) throw new ReadonlySignalError(what, value)
	return true
}

export {
	type Guard,
	CircularDependencyError,
	DuplicateKeyError,
	InvalidCallbackError,
	InvalidCollectionSourceError,
	InvalidSignalValueError,
	NullishSignalValueError,
	ReadonlySignalError,
	assert,
	createError,
	validateCallback,
	validateSignalValue,
	guardMutableSignal,
}
