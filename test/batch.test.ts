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
		effect((res) => {
			result = res;
			count++;
		}, cause);
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
		effect((res) => {
			result = res;
			count++;
		}, sum);
		batch(() => {
			a.set(6);
			b.set(8);
			c.set(10);
		});
		expect(result).toBe(24);
		expect(count).toBe(2); // + 1 for effect initialization
	});

});
