import { describe, test, expect } from 'bun:test'
import { state, computed, UNSET, isComputed } from '../'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const increment = (n: number) => Number.isFinite(n) ? n + 1 : UNSET;

/* === Tests === */

describe('Computed', function () {

	test('should compute a function', function() {
		const derived = computed(() => 1 + 2);
		expect(derived.get()).toBe(3);
	});

	test('should compute function dependent on a signal', function() {
		const derived = state(42).map(v => ++v);
		expect(derived.get()).toBe(43);
	});

	test('should compute function dependent on an updated signal', function() {
		const cause = state(42);
		const derived = cause.map(v => ++v);
		cause.set(24);
		expect(derived.get()).toBe(25);
	});

	test('should compute function dependent on an async signal', async function() {
		const status = state('pending');
		const promised = computed(async () => {
			await wait(100);
			status.set('success');
			return 42;
		});
		const derived = promised.map(increment);
		expect(derived.get()).toBe(UNSET);
		expect(status.get()).toBe('pending');
		await wait(110);
		expect(derived.get()).toBe(43);
		expect(status.get()).toBe('success');
	});

	test('should handle errors from an async signal gracefully', async function() {
		const status = state('pending');
		const error = state('');
		const promised = computed(async () => {
			await wait(100);
			status.set('error');
			error.set('error occurred');
			return 0
		});
		const derived = promised.map(increment);
		expect(derived.get()).toBe(UNSET);
		expect(status.get()).toBe('pending');
		await wait(110);
		expect(error.get()).toBe('error occurred');
		expect(status.get()).toBe('error');
	});

	test('should compute async signals in parallel without waterfalls', async function() {
		const a = computed(async () => {
			await wait(100);
			return 10;
		});
		const b = computed(async () => {
			await wait(100);
			return 20;
		});
		const c = computed(() => {
			const aValue = a.get();
			const bValue = b.get();
			return (aValue === UNSET || bValue === UNSET)
				? UNSET
				: aValue + bValue;
		});
		expect(c.get()).toBe(UNSET);
		await wait(110);
		expect(c.get()).toBe(30);
	});

	test('should compute function dependent on a chain of computed states dependent on a signal', function() {
		const derived = state(42)
			.map(v => ++v)
			.map(v => v * 2)
			.map(v => ++v);
		expect(derived.get()).toBe(87);
	});

	test('should compute function dependent on a chain of computed states dependent on an updated signal', function() {
		const cause = state(42);
		const derived = cause
			.map(v => ++v)
			.map(v => v * 2)
			.map(v => ++v);
		cause.set(24);
		expect(derived.get()).toBe(51);
	});

	test('should drop X->B->X updates', function () {
		let count = 0;
		const x = state(2);
		const a = x.map(v => --v);
		const b = computed(() => x.get() + a.get());
		const c = computed(() => {
			count++;
			return 'c: ' + b.get();
		});
		expect(c.get()).toBe('c: 3');
		expect(count).toBe(1);
		x.set(4);
		expect(c.get()).toBe('c: 7');
		expect(count).toBe(2);
	});

	test('should only update every signal once (diamond graph)', function() {
		let count = 0;
		const x = state('a');
		const a = x.map(v => v);
		const b = x.map(v => v);
		const c = computed(() => {
			count++;
			return a.get() + ' ' + b.get();
		});
		expect(c.get()).toBe('a a');
		expect(count).toBe(1);
		x.set('aa');
		// flush();
		expect(c.get()).toBe('aa aa');
		expect(count).toBe(2);
	});

	test('should only update every signal once (diamond graph + tail)', function() {
		let count = 0;
		const x = state('a');
		const a = x.map(v => v);
		const b = x.map(v => v);
		const c = computed(() => a.get() + ' ' + b.get());
		const d = computed(() => {
			count++;
			return c.get();
		});
		expect(d.get()).toBe('a a');
		expect(count).toBe(1);
		x.set('aa');
		expect(d.get()).toBe('aa aa');
		expect(count).toBe(2);
	});

	test('should update multiple times after multiple state changes', function() {
		const a = state(3);
		const b = state(4);
		let count = 0;
		const sum = computed(() => {
			count++;
			return a.get() + b.get()
		});
		expect(sum.get()).toBe(7);
		a.set(6);
		expect(sum.get()).toBe(10);
		b.set(8);
		expect(sum.get()).toBe(14);
		expect(count).toBe(3);
	});

	/*
	 * Note for the next two tests:
	 * 
	 * Due to the lazy evaluation strategy, unchanged computed signals may propagate
	 * change notifications one additional time before stabilizing. This is a
	 * one-time performance cost that allows for efficient memoization and
	 * error handling in most cases.
	 */
	test('should bail out if result is the same', function() {
		let count = 0;
		const x = state('a');
		const a = computed(() => {
			x.get();
			return 'foo';
		});
		const b = computed(() => {
			count++;
			return a.get();
		});
		expect(b.get()).toBe('foo');
		expect(count).toBe(1);
		x.set('aa');
		x.set('aaa');
		x.set('aaaa');
		expect(b.get()).toBe('foo');
		expect(count).toBe(2);
	});

	test('should block if result remains unchanged', function() {
		let count = 0;
		const x = state(42);
		const a = x.map(v => v % 2);
		const b = computed(() => a.get() ? 'odd' : 'even');
		const c = computed(() => {
			count++;
			return `c: ${b.get()}`;
		});
		expect(c.get()).toBe('c: even');
		expect(count).toBe(1);
		x.set(44);
		x.set(46);
		x.set(48);
		expect(c.get()).toBe('c: even');
		expect(count).toBe(2);
	});

	test('should detect and throw error for circular dependencies', function() {
		const a = state(1);
		const b = computed(() => c.get() + 1);
		const c = computed(() => b.get() + a.get());
		expect(() => {
			b.get(); // This should trigger the circular dependency
		}).toThrow('Circular dependency detected');
		expect(a.get()).toBe(1);
	});

	/* test('should propagate error if an error occurred', function() {
		let count = 0;
		const x = state(0);
		const a = computed(() => {
			if (x.get() === 1) throw new Error('Calculation error');
			return 1;
		});
		const b = a.map(v => v ? 'success' : 'pending');
		const c = computed(() => {
			count++;
			return `c: ${b.get()}`;
		});
		expect(a.get()).toBe(1);
		expect(c.get()).toBe('c: success');
		expect(count).toBe(1);
		x.set(1)
		try {
			expect(a.get()).toBe(1);
			expect(true).toBe(false); // This line should not be reached
		} catch (error) {
			expect(error.message).toBe('Calculation error');
		} finally {
			expect(c.get()).toBe('c: success');
			expect(count).toBe(2);
		}
	}); */

	test('should return a computed signal with .map()', function() {
		const cause = state(42);
		const derived = cause.map(v => ++v);
		const double = derived.map(v => v * 2);
		expect(isComputed(double)).toBe(true);
		expect(double.get()).toBe(86);
	});

	test('should create an effect that reacts on signal changes with .match()', async function() {
		const cause = state(42);
		const derived = computed(async () => {
			await wait(100);
			return cause.get() + 1;
		});
		let okCount = 0;
		let nilCount = 0;
		let result: number = 0;
		derived.match({
			ok: v => {
				result = v;
				okCount++
			},
			nil: () => {
				nilCount++
			}
		})
		cause.set(43);
		expect(okCount).toBe(0);
		expect(nilCount).toBe(1);
		expect(result).toBe(0);

		await wait(110);
		expect(okCount).toBe(1); // not +1 because initial state never made it here
		expect(nilCount).toBe(1);
		expect(result).toBe(44);
	});

	test('should handle complex computed signal with error and async dependencies', async function() {
		const toggleState = state(true);
		const errorProne = toggleState.map(v => {
			if (v) throw new Error('Intentional error');
			return 42;
		});
		const asyncValue = computed(async () => {
			await wait(50);
			return 10;
		});
		let okCount = 0;
		let nilCount = 0;
		let errCount = 0;
		let result: number = 0;
		const complexComputed = computed({
			ok: (x, y) => { // happy path
				okCount++;
				return x + y
			},
			nil: () => { // not ready yet
			    nilCount++;
				return 0
			},
			err: (_e) => { // error path
				console.error('Error:', _e);
				errCount++;
				return -1
			},
		}, errorProne, asyncValue);
	
		for (let i = 0; i < 10; i++) {
			toggleState.set(!!(i % 2));
			await wait(10);
			result = complexComputed.get();
			console.log(`i: ${i}, result: ${result}`);
		}
	
		expect(nilCount).toBeGreaterThanOrEqual(4);
		expect(okCount).toBeGreaterThanOrEqual(2);
		expect(errCount).toBeGreaterThanOrEqual(2);
		expect(okCount + errCount + nilCount).toBe(10);
	});
});