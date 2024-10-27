import { attempt, Err } from '@efflore/flow-sure'
import { log, LOG_ERROR } from './log'

/* === Types === */

type ElementFunction = (element: Element) => () => void
type Enqueue = (element: Element, prop: string, fn: ElementFunction) => void
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Cleanup = (key: unknown, fn: Function) => void

type Scheduler = {
	enqueue: Enqueue,
	cleanup: Cleanup
}

/* === Exported Function === */

/**
 * Schedules functions to be executed after the next animation frame or after all events have been dispatched
 * 
 * @since 0.8.0
 * @returns {Scheduler}
 */
const scheduler = (): Scheduler => {
	const effectQueue = new Map()
	const cleanupQueue = new Map()
	let requestId: number | null

	const run = (fn: () => void, msg: string) => attempt(fn).match({
		Err: error => Err(log(error, msg, LOG_ERROR))
	})

	const flush = () => {
		requestId = null
		effectQueue.forEach(
			(elEffect, el) => elEffect.forEach(
				(fn: ElementFunction, prop: string) =>
					run(fn(el), `Effect ${prop} on ${el?.localName || 'unknown'} failed`)
			)
		)
		effectQueue.clear()
		cleanupQueue.forEach(fn => run(fn, 'Cleanup failed'))
		cleanupQueue.clear()
	}

	const requestTick = () => {
		if (requestId) cancelAnimationFrame(requestId)
		requestId = requestAnimationFrame(flush)
	}

	const getEffectMap = (key: Element) => {
		if (!effectQueue.has(key)) effectQueue.set(key, new Map())
		return effectQueue.get(key)
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	const addToQueue = (map: Map<unknown, Function>) =>
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		(key: unknown, fn: Function) => {
			const more = !map.has(key)
			map.set(key, fn)
			if (more) requestTick()
		}

	queueMicrotask(flush) // initial flush when the call stack is empty
	return {
		enqueue: (element: Element, prop: string, fn: ElementFunction) => addToQueue(getEffectMap(element))(prop, fn),
		cleanup: addToQueue(cleanupQueue)
	}
}

export { type Enqueue, type Cleanup, type Scheduler, scheduler }
