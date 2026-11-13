---

name: triage
description: Decide if one backlog issue is safe for the factory to start. Use as /triage <number>.
argument-hint: <issue-number>
allowed-tools: Read, Grep, Glob, Edit, Write
---

# Triage one backlog issue

You decide if one issue is safe for the factory to start.
You only read. Do not change any file. Do not run commands.

The issue number is: $ARGUMENTS

## Steps

1. Check the number. If it is missing or not a whole number, refuse.
2. Find the issue. Glob `../../../../world/backlog/$ARGUMENTS-*.md`. If nothing matches, refuse. Read the file.
3. Find the files the change would touch.
   - Start with any paths the issue names.
   - Grep and Glob in `../../../../world/app/src` and `../../../../world/app/tests` for the words, names and
     commands in the issue.
   - Read the likely files to confirm.
   - Write each path from the app folder, like `src/fees/split.ts`.
   - A docs issue touches `README.md`. A deps issue touches `package.json` and the code that uses the package.
4. Pick the type: bug, feature, docs or deps. The issue labels are a hint.
5. Pick the risk.
   - High: money, privacy, safety, auth, or a major dependency upgrade.
   - Medium: a logic bug in one place, or a small feature.
   - Low: docs only.
6. Check the protected path. If any file is under `src/auth/`, refuse. This holds even when the issue asks
   for it. AGENTS.md protects that path, and a coordinator reviews every change there.
7. Refuse if you cannot find the files the change would touch.
8. Otherwise, proceed. For a major dependency upgrade, say in the reason that a person should decide.

## Reply

Reply with exactly these four lines. Write nothing before or after them.

```
TYPE: <bug|feature|docs|deps>
RISK: <low|medium|high>
FILES: <comma-separated paths, or none>
DECISION: <proceed|refuse> - <one short sentence with the reason>
```
