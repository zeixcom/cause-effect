import { valueString } from './util'

class CircularDependencyError extends Error {
	constructor(where: string) {
		super(`Circular dependency detected in ${where}`)
		this.name = 'CircularDependencyError'
	}
}

class DuplicateKeyError extends Error {
	constructor(where: string, key: string, value?: unknown) {
		super(
			`Could not add ${where} key "${key}" ${value && `with value ${valueString(value)}`}because it already exists`,
		)
		this.name = 'StoreKeyExistsError'
	}
}

class ForbiddenMethodCallError extends Error {
	constructor(method: string, where: string, reason: string) {
		super(`Forbidden method call ${method} in ${where} because ${reason}`)
		this.name = 'ForbiddenMethodCallError'
	}
}

class InvalidCallbackError extends TypeError {
	constructor(where: string, value: unknown) {
		super(`Invalid ${where} callback ${valueString(value)}`)
		this.name = 'InvalidCallbackError'
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

class StoreIndexRangeError extends RangeError {
	constructor(index: number) {
		super(
			`Could not remove store index ${String(index)} because it is out of range`,
		)
		this.name = 'StoreKeyRangeError'
	}
}

class StoreKeyReadonlyError extends Error {
	constructor(key: string, value: unknown) {
		super(
			`Could not set store key "${key}" to ${valueString(value)} because it is read-only`,
		)
		this.name = 'StoreKeyReadonlyError'
	}
}

export {
	CircularDependencyError,
	DuplicateKeyError,
	ForbiddenMethodCallError,
	InvalidCallbackError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreIndexRangeError,
	StoreKeyReadonlyError,
}
