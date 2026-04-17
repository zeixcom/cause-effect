<process>
## Step 1: Read the handoff

Locate the task in `TODO.md` marked `— done, pending review ⏳`. Read:
- **Changed:** which files and locations were modified
- **How:** the implementation approach
- **Check:** where the developer flagged review focus

## Step 2: Read the changed files

Read changed source files in full. Do not review from the handoff summary alone.

## Step 3: Evaluate against REQUIREMENTS.md

- Does the API surface align with Must Have / Should Have requirements?
- Does it serve the intended personas?
- Does it introduce anything from Should Avoid or Out of Scope?

## Step 4: Evaluate DX and consistency

Read `CLAUDE.md` and `ARCHITECTURE.md` for established patterns:
- Is the API ergonomic? Would a library consumer write this naturally?
- Is naming consistent with the existing surface?
- Are defaults sensible? Is it easy to misuse?
- If a new concept is introduced — is it justified?

## Step 5: Resolve

**Approved:** Update the task status to `— reviewed ✓`. Add a one-line **Review:** note if useful.

**Issues found:** Do not ask the developer to redo the task. Instead:
- Create follow-up tasks in `TODO.md` referencing the original
- Name the exact API, describe the problem, suggest what a better design looks like
- If the issue is architectural, do that design work first, then write the task
</process>

<success_criteria>
- Changed files read in full, not just the handoff summary
- Review grounded in REQUIREMENTS.md and ARCHITECTURE.md — not personal preference
- Task status updated in TODO.md
- Issues produce concrete, actionable follow-up tasks with sufficient context
</success_criteria>
