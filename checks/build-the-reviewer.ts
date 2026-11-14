// build-the-reviewer: a read-only reviewer that answers in a fixed JSON contract,
// and three real runs on the clean fix for issue 3 that pass it.
import { agent, MODEL_ALIASES } from "../parts/03-split-the-roles/agents";
import {
  demandsEvidence,
  passed,
  ranAsReviewer,
  reviewerPrompt,
  reviewerReadsOnly,
  reviewRuns,
} from "../parts/03-split-the-roles/reviews";
import { enoughRuns } from "../parts/03-split-the-roles/transcripts";
import type { Rule } from "../scripts/verify";
import { ranCommand, readSession, subagentCalls } from "./lib/session";

const RUNS_NEEDED = 3;
const PASSING_RUNS_NEEDED = 2;
const CONTRACT_WORDS = ["verdict", "pass", "block", "findings", "file", "line", "evidence"];

export default [
  {
    says: "reviewer.md lists its tools, and none of them can change a file or run any command",
    test: reviewerReadsOnly,
    tryNext:
      "ask Claude Code to set tools: Read, Grep, Glob in reviewer.md; " +
      "a reviewer that can edit will fix the bug instead of reporting it",
  },
  {
    says: "reviewer.md sets a model",
    test: (folder) => MODEL_ALIASES.includes(String(agent(folder, "reviewer")?.data.model)),
    tryNext: "ask Claude Code to add model: sonnet to reviewer.md",
  },
  {
    says: "the prompt sets the JSON reply: verdict pass or block, findings: file, line, evidence",
    test: (folder) => {
      const prompt = reviewerPrompt(folder);
      return CONTRACT_WORDS.every((word) => prompt.includes(word));
    },
    tryNext:
      'ask Claude Code to end reviewer.md with the reply shape: {"verdict": "pass" or "block", ' +
      '"findings": [{"file", "line", "evidence"}]}',
  },
  {
    says: "the prompt tells the reviewer to skip style",
    test: (folder) => /style/i.test(reviewerPrompt(folder)),
    tryNext: "ask Claude Code to add one line: skip style, naming and formatting",
  },
  {
    says: "the prompt allows a block only with evidence: the input that breaks the code",
    test: demandsEvidence,
    tryNext:
      "ask Claude Code to write: block only with evidence, the exact input that breaks the code " +
      "and what the code returns for it",
  },
  {
    says: `runs/review-clean/ holds ${RUNS_NEEDED} real claude -p runs made as the reviewer`,
    test: (folder) => {
      const transcripts = reviewRuns(folder, "clean");
      return transcripts.length >= RUNS_NEEDED && transcripts.every(ranAsReviewer);
    },
    tryNext:
      "run the claude -p --agent reviewer command in this step's README from this folder; " +
      "if a run had Edit or Bash, fix the reviewer's tools first",
  },
  {
    says: `at least ${PASSING_RUNS_NEEDED} runs reply with JSON whose verdict is pass`,
    test: (folder) => enoughRuns(reviewRuns(folder, "clean"), PASSING_RUNS_NEEDED, passed),
    tryNext:
      "read a run that blocked the clean fix; if its evidence is a doubt, not an input, " +
      "tell Claude Code that a guess is not a finding",
  },
  {
    says: "your saved session shows /code-review run, and a reviewer subagent doing the review",
    test: (folder) => {
      const session = readSession(folder);
      const reviewers = subagentCalls(session).filter(
        (call) => String(call.input?.subagent_type ?? "") === "reviewer",
      );
      return ranCommand(session, "code-review") && reviewers.length > 0;
    },
    tryNext: "run /code-review and ask it to use your reviewer subagent, then save the session",
  },
] satisfies Rule[];
