// The only file that names a model. Code asks for a role (fast, smart, judge), never an id.
// LLM_PROVIDER picks the provider: replay (default, recorded replies, no key), anthropic, openrouter, openai, ollama.
// Keys come from a git-ignored .env; .env.example lists the names.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export type Role = "fast" | "smart" | "judge";
export type Provider = "replay" | "anthropic" | "openrouter" | "openai" | "ollama";
export const ROLES: Role[] = ["fast", "smart", "judge"];

// Ids read from the providers' live model lists, checked again on the build date.
export const IDS: Record<Exclude<Provider, "replay">, Record<Role, string>> = {
  anthropic: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5", judge: "claude-haiku-5-5" },
  openrouter: { fast: "nvidia/nemotron-3.5-lightning", smart: "anthropic/claude-sonnet-5.5", judge: "anthropic/claude-haiku-5.5" },
  openai: { fast: "gpt-6-luna", smart: "gpt-6-luna-pro", judge: "gpt-6-luna" },
  ollama: { fast: "qwen3:8b", smart: "qwen3:32b", judge: "qwen3:8b" },
};

// Claude Code's own model aliases, used in agent frontmatter by the finished factory. Stage to role.
export const CLAUDE_CODE_ALIAS: Record<Role, string> = { fast: "haiku", smart: "sonnet", judge: "sonnet" };

// The oldest Claude Code the course is tested against: the npm "stable" tag on the build date.
export const MIN_CLAUDE_CODE = "2.1.311";

const KEY: Record<Provider, string | null> = {
  replay: null,
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  ollama: null,
};

export function provider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? "replay").toLowerCase();
  if (!(p in KEY)) throw new Error(`LLM_PROVIDER=${p} is not one of ${Object.keys(KEY).join(", ")}`);
  return p as Provider;
}

export function providerStatus(): { ok: boolean; says: string; fix: string } {
  const p = provider();
  const key = KEY[p];
  if (!key) return { ok: true, says: `model provider ${p}${p === "replay" ? " (recorded replies, no key needed)" : ""}`, fix: "" };
  const has = Boolean(process.env[key]);
  return { ok: has, says: `model provider ${p}, ${key} ${has ? "is set" : "is missing"}`, fix: `put ${key} in .env, never on the command line` };
}

// The model for a role on the chosen provider. Replay has no model: callers read recorded replies instead.
export function model(role: Role): LanguageModel {
  const p = provider();
  if (p === "replay") throw new Error("LLM_PROVIDER is replay: read a recorded reply instead of calling a model");
  const id = IDS[p][role];
  if (p === "anthropic") return createAnthropic()(id);
  if (p === "openrouter") return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(id);
  if (p === "openai") return createOpenAI()(id);
  return createOpenAI({ baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1", apiKey: "ollama" })(id);
}

export const models = { fast: () => model("fast"), smart: () => model("smart"), judge: () => model("judge") };
