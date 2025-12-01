class CircularDependencyError extends Error {
	constructor(where: string) {
		super(`Circular dependency detected in ${where}`)
		this.name = 'CircularDependencyError'
	}
}

class InvalidCallbackError extends TypeError {
	constructor(where: string, value: string) {
		super(`Invalid ${where} callback ${value}`)
		this.name = 'InvalidCallbackError'
	}
}

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

class StoreKeyRangeError extends RangeError {
	constructor(index: number) {
		super(
			`Could not remove store index ${String(index)} because it is out of range`,
		)
		this.name = 'StoreKeyRangeError'
	}
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
	CircularDependencyError,
	InvalidCallbackError,
	InvalidSignalValueError,
	NullishSignalValueError,
	StoreKeyExistsError,
	StoreKeyRangeError,
	StoreKeyReadonlyError,
}
