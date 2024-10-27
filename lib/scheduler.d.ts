type ElementFunction = (element: Element) => () => void;
type Enqueue = (element: Element, prop: string, fn: ElementFunction) => void;
type Cleanup = (key: unknown, fn: Function) => void;
type Scheduler = {
    enqueue: Enqueue;
    cleanup: Cleanup;
};
/**
 * Schedules functions to be executed after the next animation frame or after all events have been dispatched
 *
 * @since 0.8.0
 * @returns {Scheduler}
 */
declare const scheduler: () => Scheduler;
export { type Enqueue, type Cleanup, type Scheduler, scheduler };
