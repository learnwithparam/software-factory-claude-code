// Read the reviewer: its prompt, and the JSON verdict in the final reply of each recorded run.
// Kept in this part folder for now; the course's checks/lib is the place it belongs.
import { join } from "node:path";
import { agent, agentTools, readsOnly } from "./agents";
import { finalReply, initEvent, isRealRun, type Transcript, transcriptsIn } from "./transcripts";

export type Finding = { file: string; line: number; evidence: string };
export type Review = { verdict: string; findings: Finding[] };

// The planted change sits in this hunk of src/loans/reserve.ts: @@ -4,8 +4,9 @@.
export const PLANTED_FILE = "src/loans/reserve.ts";
export const PLANTED_LINES = { first: 4, last: 12 };

export function reviewerPrompt(folder: string): string {
  return agent(folder, "reviewer")?.body ?? "";
}

export function reviewerReadsOnly(folder: string): boolean {
  return readsOnly(agentTools(folder, "reviewer"));
}

// The prompt asks for proof: block only with the exact input that breaks the code.
export function demandsEvidence(folder: string): boolean {
  const prompt = reviewerPrompt(folder);
  return /evidence/i.test(prompt) && /\binput/i.test(prompt);
}

// The JSON object in a reply, even when a code fence or a sentence is around it.
export function parseReview(reply: string): Review | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const review = JSON.parse(reply.slice(start, end + 1));
    if (!Array.isArray(review.findings)) review.findings = [];
    return review as Review;
  } catch {
    return null;
  }
}

export const reviewOf = (transcript: Transcript) => parseReview(finalReply(transcript));

export function reviewRuns(folder: string, diff: "clean" | "planted"): Transcript[] {
  return transcriptsIn(join(folder, "runs", `review-${diff}`));
}

// The session ran as the reviewer when its only tools were reading tools.
export function ranAsReviewer(transcript: Transcript): boolean {
  const tools = initEvent(transcript)?.tools ?? [];
  return isRealRun(transcript) && readsOnly(tools);
}

export function passed(transcript: Transcript): boolean {
  return reviewOf(transcript)?.verdict === "pass";
}

function inPlantedLines(finding: Finding): boolean {
  const line = Number(finding.line);
  const rightFile = String(finding.file).endsWith(PLANTED_FILE);
  return rightFile && line >= PLANTED_LINES.first && line <= PLANTED_LINES.last;
}

// Two dates such as 2026-03-13, or two days of the month such as "the 13th".
export function namesDatePair(evidence: string): boolean {
  const dates = evidence.match(/\d{4}-\d{2}-\d{2}|\b\d{1,2}(st|nd|rd|th)\b|'\d{2}-\d{2}'/g) ?? [];
  return dates.length >= 2;
}

// A block whose finding points at the planted lines and proves it with a date pair.
export function caughtThePlantedBug(transcript: Transcript): boolean {
  const review = reviewOf(transcript);
  if (review?.verdict !== "block") return false;
  return review.findings.some(
    (finding) => inPlantedLines(finding) && namesDatePair(String(finding.evidence)),
  );
}

export function blockedInPlantedLines(transcript: Transcript): boolean {
  const review = reviewOf(transcript);
  return review?.verdict === "block" && review.findings.some(inPlantedLines);
}
