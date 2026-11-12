# When something goes wrong

Every message a script in this repo prints on failure is in this table.

| What you see | What it means | Fix |
|---|---|---|
| `bun: command not found` | Bun is not installed. | Install it from bun.sh, then open a new terminal. |
| `FAIL  Bun 1.x.x` from the doctor | Your Bun is older than 1.4. | Run `bun upgrade`. |
| `FAIL  packages installed` | `bun install` has not run in this folder. | Run `bun install` at the repo root. |
| `FAIL  library database built` | The database could not be created in `world/data/`. | Run `bun run world reset` and check the folder is writable. |
| `FAIL  platform win32` | You are on Windows outside WSL2. | Open the repo inside WSL2 and run the commands there. |
| `doctor: not ready` | One or more required checks failed. | Fix each `FAIL` line, then run `bun run doctor` again. |
| `--    Claude Code not found` | The `claude` CLI is not installed. Replay still works. | `npm install -g @anthropic-ai/claude-code`, then `claude --version`. |
| `--    Claude Code 2.x.x` | Your Claude Code is older than the version this course is tested on. | Run `claude update`. |
| `--    model provider ..., ..._API_KEY is missing` | You chose a live provider but gave no key. | Put the key in `.env` (copy `.env.example`). Never type it on the command line. |
| `LLM_PROVIDER=... is not one of ...` | The provider name is misspelled. | Use `replay`, `anthropic`, `openrouter`, `openai` or `ollama`. |
| `models: ... fail  no recorded reply for this prompt` | Replay mode only knows the recorded runs. | Use the sample prompt, or set a live provider and key in `.env`. |
| `models: N role(s) failed` | A live call failed: wrong key, no credit, or no network. | Read the line above it, check the key and the provider's console. |
| `replay: there is no recorded run for issue N` | Only issue 2 is recorded. | Run `bun run factory:replay 2`. |
| `recording is stale: ... no longer has the text it edits` | Someone changed `world/app/src` and the recording no longer fits. | Run `git checkout world/app` to restore the app. |
| `replay: error, the result does not match the contract` | The result file lost a field the contract needs. | Open an issue on the course repo with the full output. |
| `gate: fail, N of M tests failed` | A test in the app fails on the code as it is now. | Read the failing test name above the line and fix the code, not the test. |
| `gate: error, there is no tests/ folder` | The gate was pointed at a folder that is not the app. | Run `bun run gate` with no folder, or point it at a copy of `world/app`. |
| `desk: no such item or member` | The id is not in the seed data. | Run `bun run desk overdue` or open the app to see real ids. |
| `desk: no such damage charge` | The charge id is wrong. | The seeded charge is `D-301`. |
| `There is no step called "..."` | The step name is misspelled. | Copy a name from the list it prints. |
| `There is no part called "..."` | The part name is misspelled. | Copy a name from the list it prints. |
| `ERROR the check for ... could not load` | The check itself is broken, not your work. | Open an issue with the full output. |
| `FAIL ...` then `Try next: ...` | One rule of the step is not met yet. | Do what the `Try next:` line says, then run the check again. |
| `scorecard: 0 of 6 targets met` | You have no factory runs of your own yet. | Expected until the last part. |
| `Error: listen EADDRINUSE` from `bun run app` | Something else uses port 3000. | Stop the other app, or run `PORT=3001 bun run app`. |
