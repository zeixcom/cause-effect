<<<<<<< Updated upstream
=======
import { isMutableSignal, type MutableSignal } from './signal'
import { isFunction, isSymbol, UNSET, valueString } from './util'

/* === Types === */

type Guard<T> = (value: unknown) => value is T

/* === Classes === */

>>>>>>> Stashed changes
class CircularDependencyError extends Error {
	constructor(where: string) {
		super(`Circular dependency detected in ${where}`)
		this.name = 'CircularDependencyError'
	}
}

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
class InvalidSignalValueError extends TypeError {
	constructor(where: string, value: string) {
		super(`Invalid signal value ${value} in ${where}`)
		this.name = 'InvalidSignalValueError'
	}
}

class NullishSignalValueError extends TypeError {
	constructor(where: string) {
		super(`Nullish signal values are not allowed in ${where}`)
		this.name = 'NullishSignalValueError'
	}
}

class StoreKeyExistsError extends Error {
	constructor(key: string, value: string) {
		super(
			`Could not add store key "${key}" with value ${value} because it already exists`,
		)
		this.name = 'StoreKeyExistsError'
	}
}

<<<<<<< Updated upstream
class StoreKeyRangeError extends RangeError {
	constructor(index: number) {
		super(
			`Could not remove store index ${String(index)} because it is out of range`,
		)
		this.name = 'StoreKeyRangeError'
	}
=======
/* === Functions === */

const createError = /*#__PURE__*/ (reason: unknown): Error =>
	reason instanceof Error ? reason : Error(String(reason))

const validateCallback = (
	where: string,
	value: unknown,
	guard: (value: unknown) => boolean = isFunction,
): void => {
	if (!guard(value)) throw new InvalidCallbackError(where, value)
>>>>>>> Stashed changes
}

class StoreKeyReadonlyError extends Error {
	constructor(key: string, value: string) {
		super(
			`Could not set store key "${key}" to ${value} because it is readonly`,
		)
		this.name = 'StoreKeyReadonlyError'
	}
}

export {
	type Guard,
	CircularDependencyError,
<<<<<<< Updated upstream
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreKeyExistsError,
	StoreKeyRangeError,
	StoreKeyReadonlyError,
=======
	DuplicateKeyError,
	InvalidCallbackError,
	InvalidCollectionSourceError,
	InvalidSignalValueError,
	NullishSignalValueError,
	ReadonlySignalError,
	createError,
	validateCallback,
	validateSignalValue,
	guardMutableSignal,
>>>>>>> Stashed changes
}
