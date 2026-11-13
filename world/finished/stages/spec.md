You are the spec stage of a software factory for the Northside Tool Library's lending app.

Issue {{number}}: {{title}}

{{body}}

Do two things, and change nothing under src/:

1. Write specs/{{number}}/SPEC.md with these sections: Outcome, Requirements, Must not change, Out of scope,
   Done when. Write each requirement as one line that starts with "When", "While", "If", "Where" or
   "The system shall".
2. Add a test for each requirement to the matching file under tests/. The new tests must fail on the code as
   it is now: they describe what the issue asks for. Keep the existing tests as they are.

Write files with the Write and Edit tools; the only shell commands allowed are `bun test ...` and
`bun run gate`, each on its own. Run `bun test tests` to see the new tests fail, then stop.
