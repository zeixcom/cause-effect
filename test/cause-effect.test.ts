import { describe, test, expect } from 'bun:test'
import { state, computed, isComputed, effect, flush, UNSET } from '../index'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const increment = (n: number) => Number.isFinite(n) ? n + 1 : UNSET;
const decrement = (n: number) => Number.isFinite(n) ? n - 1 : UNSET;

/* === Tests === */

describe('State', function () {

	describe('Boolean cause', function () {

		test('should be boolean', function () {
			const cause = state(false);
			expect(typeof cause.get()).toBe('boolean');
		});

		test('should set initial value to false', function () {
			const cause = state(false);
			expect(cause.get()).toBe(false);
		});

		test('should set initial value to true', function () {
			const cause = state(true);
			expect(cause.get()).toBe(true);
		});

		test('should set new value with .set(true)', function () {
			const cause = state(false);
			cause.set(true);
			expect(cause.get()).toBe(true);
		});

		test('should toggle initial value with .set(v => !v)', function () {
			const cause = state(false);
			cause.update((v) => !v);
			expect(cause.get()).toBe(true);
		});

	});

	describe('Number cause', function () {

		test('should be number', function () {
			const cause = state(0);
			expect(typeof cause.get()).toBe('number');
		});

		test('should set initial value to 0', function () {
			const cause = state(0);
			expect(cause.get()).toBe(0);
		});

		test('should set new value with .set(42)', function () {
			const cause = state(0);
			cause.set(42);
			expect(cause.get()).toBe(42);
		});

		test('should increment value with .set(v => ++v)', function () {
			const cause = state(0);
			cause.update(v => ++v);
			expect(cause.get()).toBe(1);
		});

	});

	describe('String cause', function () {

		test('should be string', function () {
			const cause = state('foo');
			expect(typeof cause.get()).toBe('string');
		});

		test('should set initial value to "foo"', function () {
			const cause = state('foo');
			expect(cause.get()).toBe('foo');
		});

		test('should set new value with .set("bar")', function () {
			const cause = state('foo');
			cause.set('bar');
			expect(cause.get()).toBe('bar');
		});

		test('should upper case value with .set(v => v.toUpperCase())', function () {
			const cause = state('foo');
			cause.update(v => v ? v.toUpperCase() : '');
			expect(cause.get()).toBe("FOO");
		});

	});

	describe('Array cause', function () {

		test('should be array', function () {
			const cause = state([1, 2, 3]);
			expect(Array.isArray(cause.get())).toBe(true);
		});

		test('should set initial value to [1, 2, 3]', function () {
			const cause = state([1, 2, 3]);
			expect(cause.get()).toEqual([1, 2, 3]);
		});

		test('should set new value with .set([4, 5, 6])', function () {
			const cause = state([1, 2, 3]);
			cause.set([4, 5, 6]);
			expect(cause.get()).toEqual([4, 5, 6]);
		});

		test('should reflect current value of array after modification', function () {
			const array = [1, 2, 3];
			const cause = state(array);
			array.push(4); // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual([1, 2, 3, 4]);
		});

		test('should set new value with .set([...array, 4])', function () {
			const array = [1, 2, 3];
			const cause = state(array);
			cause.set([...array, 4]); // use destructuring instead!
			expect(cause.get()).toEqual([1, 2, 3, 4]);
		});

	});

	describe('Object cause', function () {

		test('should be object', function () {
			const cause = state({ a: 'a', b: 1 });
			expect(typeof cause.get()).toBe('object');
		});

		test('should set initial value to { a: "a", b: 1 }', function () {
			const cause = state({ a: 'a', b: 1 });
			expect(cause.get()).toEqual({ a: 'a', b: 1 });
		});

		test('should set new value with .set({ c: true })', function () {
			const cause = state<Record<string, any>>({ a: 'a', b: 1 });
			cause.set({ c: true });
			expect(cause.get()).toEqual({ c: true });
		});

		test('should reflect current value of object after modification', function () {
			const obj = { a: 'a', b: 1 };
			const cause = state<Record<string, any>>(obj);
			// @ts-expect-error
			obj.c = true; // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true });
		});

		test('should set new value with .set({...obj, c: true})', function () {
			const obj = { a: 'a', b: 1 };
			const cause = state<Record<string, any>>(obj);
			cause.set({...obj, c: true}); // use destructuring instead!
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true });
		});

	});

	describe('Map method', function () {

		test('should return a computed signal', function() {
            const cause = state(42);
            const double = cause.map(v => v * 2);
			expect(isComputed(double)).toBe(true);
            expect(double.get()).toBe(84);
        });

	});

});

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
		flush();
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
		flush();
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
		flush();
		expect(d.get()).toBe('aa aa');
		expect(count).toBe(2);
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
		expect(b.get()).toBe('foo');
		expect(count).toBe(1);
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
		expect(c.get()).toBe('c: even');
		expect(count).toBe(1);
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

});

describe('Effect', function () {

	test('should be triggered after a state change', function() {
		const cause = state('foo');
		let effectDidRun = false;
		effect((_value) => {
			effectDidRun = true;
		}, cause);
		cause.set('bar');
		expect(effectDidRun).toBe(true);
	});

	test('should be triggered after computed async signals resolve without waterfalls', async function() {
		const a = computed(async () => {
			await wait(100);
			return 10;
		});
		const b = computed(async () => {
			await wait(100);
			return 20;
		});
		let result = 0;
		let count = 0;
		effect((aValue, bValue) => {
			result = aValue + bValue;
			count++;
		}, a, b);
		expect(result).toBe(0);
		expect(count).toBe(0);
		await wait(110);
		expect(result).toBe(30);
		expect(count).toBe(1);
	});

	test('should be triggered repeatedly after repeated state change', async function() {
		const cause = state(0);
		let result = 0;
		let count = 0;
		effect((res) => {
			result = res;
			count++;
		}, cause);
		for (let i = 0; i < 10; i++) {
			cause.set(i);
			flush();
			expect(result).toBe(i);
			expect(count).toBe(i + 1); // + 1 for the initial state change
		}
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
		flush();
		expect(sum.get()).toBe(10);
		b.set(8);
		flush();
		expect(sum.get()).toBe(14);
		expect(count).toBe(3);
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

	test('should handle errors in effects', function() {
		const a = state(1);
		const b = computed(() => {
			if (a.get() > 5) throw new Error('Value too high');
			return a.get() * 2;
		});
		let normalCallCount = 0;
		let errorCallCount = 0;
		effect({
			ok: (_bValue) => {
				// console.log('Normal effect:', _bValue);
				normalCallCount++;
			},
			err: (error) => {
				// console.log('Error effect:', error);
				errorCallCount++;
				expect(error.message).toBe('Value too high');
			}
		}, b);
	
		// Normal case
		a.set(2);
		flush();
		expect(normalCallCount).toBe(2);
		expect(errorCallCount).toBe(0);
	
		// Error case
		a.set(6);
		flush();
		expect(normalCallCount).toBe(2);
		expect(errorCallCount).toBe(1);
	
		// Back to normal
		a.set(3);
		flush();
		expect(normalCallCount).toBe(3);
		expect(errorCallCount).toBe(1);
	});

	test('should handle UNSET values in effects', async function() {
		const a = computed(async () => {
			await wait(100);
            return 42;
		});
		let normalCallCount = 0;
		let nilCount = 0;
		effect({
			ok: (aValue) => {
                normalCallCount++;
				expect(aValue).toBe(42);
            },
			nil: () => {
				nilCount++
			}
		}, a);

		expect(normalCallCount).toBe(0);
		expect(nilCount).toBe(1);
		expect(a.get()).toBe(UNSET);
		await wait(110);
		expect(normalCallCount).toBe(2); // + 1 for effect initialization
		expect(a.get()).toBe(42);
	});
});

describe('Flush', function () {

	test('should be triggered only once after repeated state change', function() {
		const cause = state(0);
		let result = 0;
		let count = 0;
		for (let i = 1; i <= 10; i++) {
			cause.set(i);
		}
		effect((res) => {
			result = res;
			count++;
		}, cause);
		expect(result).toBe(10);
		expect(count).toBe(1);
	});

	test('should be triggered only once when multiple signals are set', function() {
		const a = state(3);
		const b = state(4);
		const sum = computed(() => a.get() + b.get());
		let result = 0;
		let count = 0;
		a.set(6);
		b.set(8);
		effect((res) => {
			result = res;
			count++;
		}, sum);
		expect(result).toBe(14);
		expect(count).toBe(1);
	});

});
