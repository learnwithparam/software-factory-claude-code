// Ask a model for a role, through config/models.ts. In replay mode (the default) the reply comes from
// world/replies/, recorded from a live run, so checks, CI and a learner without a key all get the same answer.
// LLM_RECORD=1 with a live provider writes new replies there.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateText } from "ai";
import { model, provider, type Role } from "../../config/models";
import { WORLD } from "./world";

export const REPLIES = join(WORLD, "replies");
export const replyKey = (role: Role, system: string, prompt: string, run = 1) =>
  createHash("sha256").update(`${role}\n${system}\n${prompt}\n${run}`).digest("hex").slice(0, 16);

export class NoRecordedReply extends Error {}

export async function ask(role: Role, system: string, prompt: string, run = 1): Promise<{ text: string; costUsd: number }> {
  const key = replyKey(role, system, prompt, run);
  const file = join(REPLIES, `${key}.json`);
  if (provider() === "replay") {
    if (!existsSync(file))
      throw new NoRecordedReply(
        "no recorded reply for this prompt. Replay mode only knows the recorded runs; set LLM_PROVIDER and a key in .env to try your own prompt live",
      );
    const r = JSON.parse(readFileSync(file, "utf8"));
    return { text: r.text, costUsd: 0 };
  }
  const res = await generateText({ model: model(role), system, prompt, maxOutputTokens: 2000 });
  if (process.env.LLM_RECORD === "1") {
    mkdirSync(REPLIES, { recursive: true });
    writeFileSync(file, `${JSON.stringify({ role, run, text: res.text }, null, 2)}\n`);
  }
  return { text: res.text, costUsd: 0 };
}

// Model behaviour is judged over fresh runs, never one: pass when at least `need` of `runs` pass.
export async function overRuns(test: (run: number) => Promise<boolean>, runs = 3, need = 2): Promise<{ ok: boolean; passed: number }> {
  let passed = 0;
  for (let i = 1; i <= runs; i++) {
    try {
      if (await test(i)) passed++;
    } catch (e) {
      if (e instanceof NoRecordedReply) throw e;
    }
  }
  return { ok: passed >= need, passed };
}
