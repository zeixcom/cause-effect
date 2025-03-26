import { describe, test, expect } from 'bun:test'
import { state, computed, effect, batch } from '../'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Batch', function () {

	test('should be triggered only once after repeated state change', function() {
		const cause = state(0);
		let result = 0;
		let count = 0;
		effect({
			signals: [cause],
			ok: (res) => {
				result = res;
				count++;
			},
			err: () => {},
		});
		batch(() => {
			for (let i = 1; i <= 10; i++) {
				cause.set(i);
			}
		});
		expect(result).toBe(10);
		expect(count).toBe(2); // + 1 for effect initialization
	});

	test('should be triggered only once when multiple signals are set', function() {
		const a = state(3);
		const b = state(4);
		const c = state(5);
		const sum = computed(() => a.get() + b.get() + c.get());
		let result = 0;
		let count = 0;
		sum.tap({
			ok: res => {
				result = res;
				count++;
			},
			err: () => {},
		});
		batch(() => {
			a.set(6);
			b.set(8);
			c.set(10);
		});
		expect(result).toBe(24);
		expect(count).toBe(2); // + 1 for effect initialization
	});

	test('should prove example from README works', function() {

		// State: define an array of Signal<number>
		const signals = [state(2), state(3), state(5)]

		// Computed: derive a calculation ...
		const sum = computed(() => signals.reduce((total, v) => total + v.get(), 0))
			.map(v => { // ... perform validation and handle errors
				if (!Number.isFinite(v)) throw new Error('Invalid value')
				return v
			})

		let result = 0
		let okCount = 0
		let errCount = 0
		
		// Effect: switch cases for the result
		sum.tap({
			ok: v => {
				result = v
				okCount++
				// console.log('Sum:', v)
			},
			err: _error => {
				errCount++
				// console.error('Error:', error)
			}
		})

		expect(okCount).toBe(1);
		expect(result).toBe(10);

		// Batch: apply changes to all signals in a single transaction
		batch(() => {
			signals.forEach(signal => signal.update(v => v * 2))
		})

		expect(okCount).toBe(2);
		expect(result).toBe(20);

		// Provoke an error
		signals[0].set(NaN)

        expect(errCount).toBe(1);
		expect(okCount).toBe(2); // should not have changed due to error
        expect(result).toBe(20); // should not have changed due to error
	});

});
