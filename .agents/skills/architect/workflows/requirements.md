<process>
## Step 1: Read existing requirements

Read `REQUIREMENTS.md` if it exists. Understand what is already established before asking questions.

## Step 2: Interview

Ask targeted questions before writing anything. Do not write requirements during the interview.

Focus areas:
- **Problem:** What are you solving? For whom? What happens if it's not built?
- **Users:** Who are they? Technical level? Environments?
- **Workflows:** End-to-end user journeys including edge cases.
- **Constraints:** Integrations, performance, type safety, timeline.
- **Validation:** Has this been validated? What alternatives were considered?
- **Risks:** What could make this fail?

Push back on vague requirements ("fast", "simple") — demand measurable criteria. Challenge scope creep. Escalate conflicts to the user; do not resolve them silently.

**Wait for each answer before proceeding.**

## Step 3: Write or update REQUIREMENTS.md

Use only the sections that are relevant:

```markdown
# [Name] — Requirements

## 1. Problem Statement
## 2. User Personas
## 3. Functional Requirements
Must Have / Should Have / Nice to Have / Should Avoid
## 4. Non-Functional Requirements
Performance, type safety, browser support, reliability
## 5. Technical Constraints
## 6. Assumptions & Dependencies
## 7. Risks & Mitigations
## 8. Out of Scope
## 9. Open Questions
## 10. Acceptance Criteria
```

## Step 4: Confirm

Show the document to the user. Wait for confirmation before closing.
</process>

<success_criteria>
- All Must Have requirements are specific and testable
- Risks have mitigations or are explicitly accepted
- Open Questions captures everything not yet resolved
- User has reviewed and confirmed the document
</success_criteria>
