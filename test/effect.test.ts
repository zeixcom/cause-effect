import { describe, test, expect, mock } from 'bun:test'
import { state, computed, effect, UNSET } from '../'

/* === Utility Functions === */

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/* === Tests === */

describe('Effect', function () {

	test('should be triggered after a state change', function() {
		const cause = state('foo');
		let count = 0;
		effect((_value) => {
			count++;
		}, cause);
		expect(count).toBe(1);
		cause.set('bar');
		expect(count).toBe(2);
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
			expect(result).toBe(i);
			expect(count).toBe(i + 1); // + 1 for effect initialization
		}
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
		expect(normalCallCount).toBe(2);
		expect(errorCallCount).toBe(0);
	
		// Error case
		a.set(6);
		expect(normalCallCount).toBe(2);
		expect(errorCallCount).toBe(1);
	
		// Back to normal
		a.set(3);
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

	test('should log error to console when error is not handled', () => {
        // Mock console.error
        const originalConsoleError = console.error;
        const mockConsoleError = mock((message: string, error: Error) => {});
        console.error = mockConsoleError;

        try {
            const a = state(1);
            const b = computed(() => {
                if (a.get() > 5) throw new Error('Value too high');
                return a.get() * 2;
            });

            // Create an effect without explicit error handling
            effect(() => {
                b.get();
            });

            // This should trigger the error
            a.set(6);

            // Check if console.error was called with the expected message
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Unhandled error in effect:',
                expect.any(Error)
            );

            // Check the error message
            const [, error] = mockConsoleError.mock.calls[0];
            expect(error.message).toBe('Value too high');

        } finally {
            // Restore the original console.error
            console.error = originalConsoleError;
        }
    });

	test('should detect and throw error for circular dependencies in effects', () => {
		let okCount = 0
		let errCount = 0
		const count = state(0)
		
		effect({
			ok: () => {
				okCount++
				// This effect updates the signal it depends on, creating a circular dependency
				count.update(v => ++v)
			},
			err: e => {
				errCount++
				expect(e).toBeInstanceOf(Error)
				expect(e.message).toBe('Circular dependency in effect detected')
			}
		}, count)
	  
		// Verify that the count was changed only once due to the circular dependency error
		expect(count.get()).toBe(1)
		expect(okCount).toBe(1)
		expect(errCount).toBe(1)
	})
});
