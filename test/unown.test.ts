import { describe, expect, test } from 'bun:test'
import {
	createEffect,
	createScope,
	createState,
	unown,
} from '../index.ts'

describe('unown', () => {

	test('should return the value of the callback', () => {
		const result = unown(() => 42)
		expect(result).toBe(42)
	})

	test('should run the callback immediately and synchronously', () => {
		let ran = false
		unown(() => { ran = true })
		expect(ran).toBe(true)
	})

	test('scope created inside unown is not registered on the enclosing scope', () => {
		let innerCleanupRan = false
		const outerDispose = createScope(() => {
			unown(() => {
				createScope(() => {
					return () => { innerCleanupRan = true }
				})
			})
		})
		outerDispose()
		expect(innerCleanupRan).toBe(false)
	})

	test('scope created inside unown is not registered on the enclosing effect', () => {
		const trigger = createState(0)
		let innerCleanupRuns = 0

		const outerDispose = createScope(() => {
			createEffect((): undefined => {
				trigger.get()
				unown(() => {
					createScope(() => {
						return () => { innerCleanupRuns++ }
					})
				})
			})
		})

		expect(innerCleanupRuns).toBe(0)
		trigger.set(1)
		expect(innerCleanupRuns).toBe(0)
		trigger.set(2)
		expect(innerCleanupRuns).toBe(0)

		outerDispose()
	})

	test('effects inside an unowned scope survive effect re-runs (ownership bug regression)', () => {
		const listChange = createState(0)
		let componentEffectRuns = 0
		let componentCleanupRuns = 0

		const connectComponent = () => unown(() =>
			createScope(() => {
				createEffect((): undefined => {
					componentEffectRuns++
				})
				return () => { componentCleanupRuns++ }
			})
		)

		const outerDispose = createScope(() => {
			createEffect((): undefined => {
				listChange.get()
				if (listChange.get() === 0) connectComponent()
			})
		})

		expect(componentEffectRuns).toBe(1)
		expect(componentCleanupRuns).toBe(0)

		listChange.set(1)
		expect(componentEffectRuns).toBe(1)
		expect(componentCleanupRuns).toBe(0)

		outerDispose()
	})

	test('effects inside an unowned scope still run reactively', () => {
		const source = createState('a')
		let effectRuns = 0

		const dispose = unown(() =>
			createScope(() => {
				createEffect((): undefined => {
					source.get()
					effectRuns++
				})
			})
		)

		expect(effectRuns).toBe(1)
		source.set('b')
		expect(effectRuns).toBe(2)

		dispose()
		source.set('c')
		expect(effectRuns).toBe(2)
	})

	test('dispose returned from an unowned scope still works', () => {
		let cleanupRan = false
		const dispose = unown(() =>
			createScope(() => {
				return () => { cleanupRan = true }
			})
		)
		expect(cleanupRan).toBe(false)
		dispose()
		expect(cleanupRan).toBe(true)
	})

	test('nested unown calls work correctly', () => {
		let innerCleanupRan = false
		const outerDispose = createScope(() => {
			unown(() => {
				unown(() => {
					createScope(() => {
						return () => { innerCleanupRan = true }
					})
				})
			})
		})
		outerDispose()
		expect(innerCleanupRan).toBe(false)
	})

	test('restores the active owner after the callback completes', () => {
		let postCleanupRan = false
		const outerDispose = createScope(() => {
			unown(() => { /* some unowned work */ })
			createScope(() => {
				return () => { postCleanupRan = true }
			})
		})
		outerDispose()
		expect(postCleanupRan).toBe(true)
	})

	test('restores the active owner even if the callback throws', () => {
		let postCleanupRan = false
		const outerDispose = createScope(() => {
			try {
				unown(() => { throw new Error('boom') })
			} catch {
				// swallow
			}
			createScope(() => {
				return () => { postCleanupRan = true }
			})
		})
		outerDispose()
		expect(postCleanupRan).toBe(true)
	})

	test('works correctly when called outside any scope or effect', () => {
		let ran = false
		const dispose = unown(() => {
			ran = true
			return createScope(() => {
				return () => {}
			})
		})
		expect(ran).toBe(true)
		expect(typeof dispose).toBe('function')
	})

})
