import { describe, expect, test } from 'bun:test'
import { gzipSync } from 'node:zlib'

describe('Bundle size', () => {
	test('minified bundle should not regress', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
		})
		// biome-ignore lint/style/noNonNullAssertion: test
		const bytes = await result.outputs[0]!.arrayBuffer()
		const size = bytes.byteLength
		console.log(`  bundleMinified: ${size}B (limit: 25000B)`)
		expect(size).toBeLessThanOrEqual(25000)
	})

	test('gzipped bundle should not regress', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
		})
		// biome-ignore lint/style/noNonNullAssertion: test
		const bytes = await result.outputs[0]!.arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		console.log(`  bundleGzipped: ${gzipped}B (limit: 8500B)`)
		expect(gzipped).toBeLessThanOrEqual(8500)
	})
})
