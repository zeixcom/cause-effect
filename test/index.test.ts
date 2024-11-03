import { describe, test, expect } from 'bun:test'
import { State, Computed, effect, batch } from '../index'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const paint = () => new Promise(resolve => setTimeout(resolve, 1))
const increment = (n: number | void) => (n ?? 0) + 1;
const decrement = (n: number | void) => (n ?? 0) - 1;
const double = (n: number | void) => (n ?? 0) * 2;

/* === Tests === */

describe('State', function () {

	describe('Empty cause', function () {

		test('should be undefined', function () {
			const cause = State.of(undefined);
			expect(cause.get()).toBeUndefined();
		});

	});

	describe('Boolean cause', function () {

		test('should be boolean', function () {
			const cause = State.of(false);
			expect(typeof cause.get()).toBe('boolean');
		});

		test('should set initial value to false', function () {
			const cause = State.of(false);
			expect(cause.get()).toBe(false);
		});

		test('should set initial value to true', function () {
			const cause = State.of(true);
			expect(cause.get()).toBe(true);
		});

		test('should set new value with .set(true)', function () {
			const cause = State.of(false);
			cause.set(true);
			expect(cause.get()).toBe(true);
		});

		test('should toggle initial value with .set(v => !v)', function () {
			const cause = State.of(false);
			cause.set((v) => !v);
			expect(cause.get()).toBe(true);
		});

	});

	describe('Number cause', function () {

		test('should be number', function () {
			const cause = State.of(0);
			expect(typeof cause.get()).toBe('number');
		});

		test('should set initial value to 0', function () {
			const cause = State.of(0);
			expect(cause.get()).toBe(0);
		});

		test('should set new value with .set(42)', function () {
			const cause = State.of(0);
			cause.set(42);
			expect(cause.get()).toBe(42);
		});

		test('should increment value with .set(v => ++v)', function () {
			const cause = State.of(0);
			cause.set(v => ++v);
			expect(cause.get()).toBe(1);
		});

	});

	describe('String cause', function () {

		test('should be string', function () {
			const cause = State.of('foo');
			expect(typeof cause.get()).toBe('string');
		});

		test('should set initial value to "foo"', function () {
			const cause = State.of('foo');
			expect(cause.get()).toBe('foo');
		});

		test('should set new value with .set("bar")', function () {
			const cause = State.of('foo');
			cause.set('bar');
			expect(cause.get()).toBe('bar');
		});

		test('should upper case value with .set(v => v.toUpperCase())', function () {
			const cause = State.of('foo');
			cause.set(v => v ? v.toUpperCase() : '');
			expect(cause.get()).toBe("FOO");
		});

	});

	describe('Array cause', function () {

		test('should be array', function () {
			const cause = State.of([1, 2, 3]);
			expect(Array.isArray(cause.get())).toBe(true);
		});

		test('should set initial value to [1, 2, 3]', function () {
			const cause = State.of([1, 2, 3]);
			expect(cause.get()).toEqual([1, 2, 3]);
		});

		test('should set new value with .set([4, 5, 6])', function () {
			const cause = State.of([1, 2, 3]);
			cause.set([4, 5, 6]);
			expect(cause.get()).toEqual([4, 5, 6]);
		});

		test('should reflect current value of array after modification', function () {
			const array = [1, 2, 3];
			const cause = State.of(array);
			array.push(4); // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual([1, 2, 3, 4]);
		});

		test('should set new value with .set([...array, 4])', function () {
			const array = [1, 2, 3];
			const cause = State.of(array);
			cause.set([...array, 4]); // use destructuring instead!
			expect(cause.get()).toEqual([1, 2, 3, 4]);
		});

	});

	describe('Object cause', function () {

		test('should be object', function () {
			const cause = State.of({ a: 'a', b: 1 });
			expect(typeof cause.get()).toBe('object');
		});

		test('should set initial value to { a: "a", b: 1 }', function () {
			const cause = State.of({ a: 'a', b: 1 });
			expect(cause.get()).toEqual({ a: 'a', b: 1 });
		});

		test('should set new value with .set({ c: true })', function () {
			const cause = State.of<Record<string, any>>({ a: 'a', b: 1 });
			cause.set({ c: true });
			expect(cause.get()).toEqual({ c: true });
		});

		test('should reflect current value of object after modification', function () {
			const obj = { a: 'a', b: 1 };
			const cause = State.of<Record<string, any>>(obj);
			// @ts-expect-error
			obj.c = true; // don't do this! the result will be correct, but we can't trigger effects
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true });
		});

		test('should set new value with .set({...obj, c: true})', function () {
			const obj = { a: 'a', b: 1 };
			const cause = State.of<Record<string, any>>(obj);
			cause.set({...obj, c: true}); // use destructuring instead!
			expect(cause.get()).toEqual({ a: 'a', b: 1, c: true });
		});

	});

	describe('Map method', function () {

		test('should return a computed signal', function() {
            const cause = State.of(42);
            const double = cause.map(v => v * 2);
			expect(Computed.isComputed(double)).toBe(true);
            expect(double.get()).toBe(84);
        });

	});

});

describe('Computed', function () {

	test('should compute a function', function() {
		const derived = Computed.of(() => 1 + 2);
		expect(derived.get()).toBe(3);
	});

	test('should compute function dependent on a signal', function() {
		const derived = State.of(42).map(v => ++v);
		expect(derived.get()).toBe(43);
	});

	test('should compute function dependent on an updated signal', function() {
		const cause = State.of(42);
		const derived = cause.map(v => ++v);
		cause.set(24);
		expect(derived.get()).toBe(25);
	});

	test('should compute function dependent on an async signal', async function() {
		const status = State.of('pending');
		const promised = Computed.of<number>(async () => {
			await wait(100);
			status.set('success');
			return 42;
		});
		const derived = promised.map(increment);
		expect(derived.get()).toBe(1);
		expect(status.get()).toBe('pending');
		await wait(100);
		expect(derived.get()).toBe(43);
		expect(status.get()).toBe('success');
	});

	test('should handle errors from an async signal gracefully', async function() {
		const status = State.of('pending');
		const error = State.of('');
		const promised = Computed.of(async () => {
			await wait(100);
			status.set('error');
			error.set('error occurred');
			return 0
		});
		const derived = promised.map(increment);
		expect(derived.get()).toBe(1);
		expect(status.get()).toBe('pending');
		await wait(100);
		expect(error.get()).toBe('error occurred');
		expect(status.get()).toBe('error');
	});

	test('should compute function dependent on a chain of computed states dependent on a signal', function() {
		const derived = State.of(42)
			.map(v => ++v)
			.map(v => v * 2)
			.map(v => ++v);
		expect(derived.get()).toBe(87);
	});

	test('should compute function dependent on a chain of computed states dependent on an updated signal', function() {
		const cause = State.of(42);
		const derived = cause.map(v => ++v)
			.map(v => v * 2)
			.map(v => ++v);
		cause.set(24);
		expect(derived.get()).toBe(51);
	});

	test('should drop X->B->X updates', function () {
		let count = 0;
		const x = State.of(2);
		const a = x.map(decrement);
		const b = Computed.of(() => x.get() + (a.get() ?? 0));
		const c = Computed.of(() => {
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
		const x = State.of('a');
		const a = x.map(v => v);
		const b = x.map(v => v);
		const c = Computed.of(() => {
			count++;
			return a.get() + ' ' + b.get();
		});
		expect(c.get()).toBe('a a');
		expect(count).toBe(1);
		x.set('aa');
		expect(c.get()).toBe('aa aa');
		expect(count).toBe(2);
	});

	test('should only update every signal once (diamond graph + tail)', function() {
		let count = 0;
		const x = State.of('a');
		const a = x.map(v => v);
		const b = x.map(v => v);
		const c = Computed.of(() => a.get() + ' ' + b.get());
		const d = Computed.of(() => {
			count++;
			return c.get();
		});
		expect(d.get()).toBe('a a');
		expect(count).toBe(1);
		x.set('aa');
		expect(d.get()).toBe('aa aa');
		expect(count).toBe(2);
	});

	test('should bail out if result is the same', function() {
		let count = 0;
		const x = State.of('a');
		const a = Computed.of(() => {
			x.get();
			return 'foo';
		});
		const b = Computed.of(() => {
			count++;
			return a.get();
		}, true); // turn memoization on
		expect(b.get()).toBe('foo');
		expect(count).toBe(1);
		x.set('aa');
		expect(b.get()).toBe('foo');
		expect(count).toBe(1);
	});

	test('should block if result remains unchanged', function() {
		let count = 0;
		const x = State.of(42);
		const a = x.map(v => v % 2);
		const b = Computed.of(() => a.get() ? 'odd' : 'even', true);
		const c = Computed.of(() => {
			count++;
			return `c: ${b.get()}`;
		}, true);
		expect(c.get()).toBe('c: even');
		expect(count).toBe(1);
		x.set(44);
		expect(c.get()).toBe('c: even');
		expect(count).toBe(1);
	});

	test('should block if an error occurred', function() {
		let count = 0;
		const x = State.of(0);
		const a = Computed.of(() => {
			if (x.get() === 1) throw new Error('Calculation error');
			return 1;
		}, true);
		const b = a.map(v => v ? 'success' : 'pending');
		const c = Computed.of(() => {
			count++;
			return `c: ${b.get()}`;
		}, true);
		expect(a.get()).toBe(1);
		expect(c.get()).toBe('c: success');
		expect(count).toBe(1);
		x.set(1);
		try {
			expect(a.get()).toBe(1);
		} catch (error) {
			expect(error.message).toBe('Calculation error');
		} finally {
			expect(c.get()).toBe('c: success');
			expect(count).toBe(1);
		}
	});

});

describe('Effect', function () {

	/* test('should be added to state.effects', function () {
	  const cause = State.of();
	  effect(() => State.of());
	  expect(state.effects.size).toBe(1);
	  effect(() => State.of());
	  expect(state.effects.size).toBe(2);
	});

	test('should be added to computed.effects', function () {
	  const cause = State.of();
	  const derived = Computed.of(() => 1 + State.of());
	  effect(() => Computed.of());
	  expect(computed.effects.size).toBe(1);
	  const derived2 = Computed.of(() => 2 + State.of());
	  effect(() => Computed.of() + computed2());
	  expect(computed.effects.size).toBe(2);
	  expect(computed2.effects.size).toBe(1);
	}); */

	test('should be triggered after a state change', function() {
		const cause = State.of('foo');
		let effectDidRun = false;
		effect(() => {
			cause.get();
			effectDidRun = true;
		});
		cause.set('bar');
		expect(effectDidRun).toBe(true);
	});

	test('should be triggered repeatedly after repeated state change', async function() {
		const cause = State.of(0);
		let count = 0;
		effect(() => {
			cause.get();
			count++;
		});
		for (let i = 0; i < 10; i++) {
			cause.set(i);
			expect(count).toBe(i + 1); // + 1 for the initial state change
		}
	});

	test('should update multiple times after multiple state changes', function() {
		const a = State.of(3);
		const b = State.of(4);
		let count = 0;
		const sum = Computed.of(() => {
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

});

describe('Batch', function () {

	test('should be triggered only once after repeated state change', function() {
		const cause = State.of(0);
		let result = 0;
		let count = 0;
		batch(() => {
			for (let i = 1; i <= 10; i++) {
				cause.set(i);
			}
		});
		effect(() => {
			result = cause.get();
			count++;
		});
		expect(result).toBe(10);
		expect(count).toBe(1);
	});

	test('should be triggered only once multiple signals set', function() {
		const a = State.of(3);
		const b = State.of(4);
		const sum = Computed.of(() => a.get() + b.get());
		let result = 0;
		let count = 0;
		batch(() => {
			a.set(6);
            b.set(8);
		});
		effect(() => {
            result = sum.get();
			count++;
        });
		expect(sum.get()).toBe(14);
		expect(count).toBe(1);
	});

});
