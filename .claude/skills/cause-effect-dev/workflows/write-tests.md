<required_reading>
1. references/source-map.md — locate the signal type or module being tested
2. references/api-facts.md — correct API usage for test cases
3. references/non-obvious-behaviors.md — ensure gotchas are covered
4. references/error-classes.md — cover expected error conditions
</required_reading>

<process>
## Step 1: Identify what to test

Clarify the scope before writing anything:
- Which signal type or behavior is under test?
- Is this a new test, an extension of existing coverage, or a regression test for a known bug?

## Step 2: Read the source

Use references/source-map.md to locate the relevant source file in `src/nodes/`. Read it in full. Tests must match what the implementation actually does, not what you expect it to do.

## Step 3: Read existing tests

Find the existing test file for the signal type (look adjacent to or named after the source file). Read it to understand:
- Test structure and helper patterns in use
- Which behaviors are already covered
- Naming conventions

## Step 4: Identify gaps

Cross-reference the source, existing tests, and these reference files:
- references/non-obvious-behaviors.md — are gotchas covered?
- references/error-classes.md — are thrown errors tested?
- references/api-facts.md — are all option variants exercised (e.g. `equals`, `guard`)?

## Step 5: Write tests

Follow the conventions of the existing test suite. Each test should:
- Have a descriptive name that states the expected behavior
- Be self-contained (no shared mutable state between tests)
- Cover one specific behavior per test

Priority order for coverage:
1. Happy path (normal usage)
2. Edge cases and boundary conditions
3. Expected error throws (use `expect(() => ...).toThrow(ErrorClass)`)
4. Non-obvious behaviors from references/non-obvious-behaviors.md
5. Interaction with `batch`, `untrack`, `unown` if the signal participates in those

## Step 6: Verify

Run the full test suite:

```bash
bun test
```

All tests — new and existing — must pass.
</process>

<success_criteria>
- Tests cover the specified signal type or behavior
- Each test is self-contained and has a descriptive name
- Expected error conditions are tested with the correct error class
- At least one relevant non-obvious behavior is covered if applicable
- `bun test` passes with no regressions
</success_criteria>