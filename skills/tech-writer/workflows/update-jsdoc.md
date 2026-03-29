<required_reading>
1. references/tone-guide.md — jsdoc tone rules
</required_reading>

<process>
## Step 1: Read the implementation first

Read the full source file being updated. JSDoc must describe what the code actually does —
not what it should do, not what the previous version did.

For public API changes, also read `index.ts` to confirm the exported signature matches
the implementation.

## Step 2: Identify which JSDoc blocks need updating

A JSDoc block needs updating when any of the following changed:

- The function signature (parameter added, removed, renamed, or retyped)
- The return type or return value semantics
- A thrown error condition that a caller must handle
- The function no longer exists (remove the block with the function)

Do NOT update JSDoc blocks that remain accurate. Read each existing block against the
current implementation before deciding whether to edit it.

## Step 3: Write or update the JSDoc block

Follow this structure for all public API functions:

```typescript
/**
 * One-line summary. No period if it reads as a fragment; period if it reads as a sentence.
 *
 * Second paragraph only if the one-liner is genuinely insufficient — e.g. a non-obvious
 * constraint or a behavioral guarantee that cannot fit on one line. Omit otherwise.
 *
 * @param name - What it is. Include constraints (`T extends {}`, valid range, allowed
 *   values). One line per param; wrap only if a constraint needs explaining.
 * @param options - Options object, if present. Document only options that are non-obvious;
 *   skip `equals` and `guard` unless the signal's default behavior for them is unusual.
 * @returns What is returned and any guarantee about its value (e.g. "Always non-nullish").
 */
```

**Constraints on length:**
- Summary line: one line, no exceptions.
- `@param` entries: one line each unless a constraint genuinely requires a second.
- No `@example` blocks — examples live in `README.md`. Add one only if the usage pattern
  is so non-obvious that a developer would misuse the function without it.
- No `@throws` unless the error can occur in correct, non-erroneous usage (e.g.
  `UnsetSignalValueError` on `Sensor.get()` before first value). Do not document
  programmer-error throws (`RequiredOwnerError`, `InvalidCallbackError`, `CircularDependencyError`).

**Type annotations in JSDoc:**
- Do NOT repeat TypeScript types in `@param` or `@returns` tags. TypeScript already
  enforces them. Only describe semantics, not types.

## Step 4: Check consistency across the file

After updating, scan the rest of the file for any JSDoc that cross-references the changed
function or type. Update those references if they are now stale.
</process>

<success_criteria>
- Source file read in full before any edits
- Every updated block has a one-line summary
- No `@example` blocks added unless usage is genuinely non-obvious
- No `@throws` for programmer-error conditions
- TypeScript types not duplicated in JSDoc prose
- Updated blocks compile without JSDoc-related errors
- Unchanged blocks left untouched
</success_criteria>