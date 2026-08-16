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
		console.log(`  bundleMinified: ${size}B (ceiling: 32768B)`)
		// Diagnostic, not a promise — see REQUIREMENTS.md "Bundle Size". This catches
		// an accidental blowup; it is not a budget to optimise against. Re-baselined
		// from measurement at each release.
		expect(size).toBeLessThanOrEqual(32768)
	})

	test('gzipped bundle should not regress', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
		})
		// biome-ignore lint/style/noNonNullAssertion: test
		const bytes = await result.outputs[0]!.arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		console.log(`  bundleGzipped: ${gzipped}B (ceiling: 10240B)`)
		// Diagnostic, not a promise. Note this moves *opposite* to the minified figure
		// under deduplication: gzip compresses a second near-identical copy almost for
		// free, so extracting a shared helper shrinks minified and grows gzipped. Do
		// not redesign a refactor to defend this number.
		expect(gzipped).toBeLessThanOrEqual(10240)
	})

	test('core-signals-only (tree-shaken) gzipped bundle should stay below 4 kB', async () => {
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
		console.log(`  bundleCoreGzipped: ${gzipped}B (HARD limit: 4096B)`)
		// REQUIREMENTS.md: "Core signals only ... Below 4 kB" gzipped (4096B).
		// If this regresses, do not just raise the limit — update the "Below
		// 4 kB" claim in REQUIREMENTS.md and README.md to the real figure,
		// and leave a note in NOTES.md for the Architect.
		expect(gzipped).toBeLessThanOrEqual(4096)
	})
})
