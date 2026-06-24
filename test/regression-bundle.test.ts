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
		console.log(`  bundleMinified: ${size}B (limit: 24576B)`)
		expect(size).toBeLessThanOrEqual(24576)
	})

	test('gzipped bundle should not regress', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
		})
		// biome-ignore lint/style/noNonNullAssertion: test
		const bytes = await result.outputs[0]!.arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		console.log(`  bundleGzipped: ${gzipped}B (limit: 8192B)`)
		expect(gzipped).toBeLessThanOrEqual(8192)
	})

	test('core-signals-only (tree-shaken) gzipped bundle should stay below 5 kB', async () => {
		// Imports only State, Memo, Task, Effect from the package barrel and
		// actually wires them together — see test/util/core-entry.ts. A
		// bare re-export would let the bundler eliminate code a real
		// consumer's usage would retain, overstating how well this tree-shakes.
		const result = await Bun.build({
			entrypoints: ['./test/util/core-entry.ts'],
			minify: true,
		})
		// biome-ignore lint/style/noNonNullAssertion: test
		const bytes = await result.outputs[0]!.arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		console.log(`  bundleCoreGzipped: ${gzipped}B (limit: 4096B)`)
		// REQUIREMENTS.md: "Core signals only ... Below 4 kB" gzipped (4096B).
		// If this regresses, do not just raise the limit — update the "Below
		// 4 kB" claim in REQUIREMENTS.md and README.md to the real figure,
		// and leave a note in NOTES.md for the Architect (see TODO.md CE-014).
		expect(gzipped).toBeLessThanOrEqual(4096)
	})
})
