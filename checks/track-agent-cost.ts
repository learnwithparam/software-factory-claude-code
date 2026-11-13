// track-agent-cost: a LiteLLM gateway holds the spend cap as a virtual key with a budget.
// Claude Code ran the gateway and saved what it saw in evidence/. This check reads those files.
// It never starts Docker and never calls a model, so it runs with no key.
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { json, listFiles, read } from "./lib/files";

export const LITELLM_IMAGE = "ghcr.io/berriai/litellm:v1.109.1";
const KEY_PATTERN = /sk-[A-Za-z0-9_-]{8,}/;
const SKIPPED = /^(\.env$|node_modules\/|result\.json$)/;
const MOST_BUDGET_USD = 1;

// biome-ignore-start lint/style/useNamingConvention: LiteLLM names these keys.
type KeyInfo = { info?: { max_budget?: number | null; spend?: number } };
type Stage = { exit_code?: number; base_url?: string };
type Refusal = { status?: number; error?: { type?: string } };
// biome-ignore-end lint/style/useNamingConvention: LiteLLM names these keys.

const keyInfo = (folder: string) => json<KeyInfo>(join(folder, "evidence", "key-info.json"));

function imageIsPinned(folder: string): boolean {
  const lines = (read(join(folder, "compose.yml")) ?? "").split("\n");
  const trimmed = lines.map((line) => line.trim());
  const imageLine = trimmed.find((line) => line.startsWith("image:") && line.includes("litellm"));
  return imageLine === `image: ${LITELLM_IMAGE}`;
}

function keyHasBudget(folder: string): boolean {
  const budget = keyInfo(folder)?.info?.max_budget;
  return typeof budget === "number" && budget > 0 && budget <= MOST_BUDGET_USD;
}

function stageRanThroughTheProxy(folder: string): boolean {
  const stage = json<Stage>(join(folder, "evidence", "stage.json"));
  const throughProxy = /^http:\/\/(localhost|127\.0\.0\.1):4000/.test(stage?.base_url ?? "");
  const spent = keyInfo(folder)?.info?.spend ?? 0;
  return stage?.exit_code === 0 && throughProxy && spent > 0;
}

function requestAfterBudgetIsRefused(folder: string): boolean {
  const refusal = json<Refusal>(join(folder, "evidence", "refused.json"));
  return refusal?.status === 422 && refusal.error?.type === "budget_exceeded";
}

function noKeyInAnyFile(folder: string): boolean {
  const files = listFiles(folder).filter((file) => !SKIPPED.test(file));
  return files.every((file) => !KEY_PATTERN.test(read(join(folder, file)) ?? ""));
}

const rules: Rule[] = [
  {
    says: `the LiteLLM image is pinned to ${LITELLM_IMAGE}`,
    test: imageIsPinned,
    tryNext: "Ask Claude Code to pin the litellm image in compose.yml to the exact tag.",
  },
  {
    says: "a virtual key exists with a small max_budget (evidence/key-info.json)",
    test: keyHasBudget,
    tryNext: "Ask Claude Code to make a virtual key with max_budget 0.05 and save its key info.",
  },
  {
    says: "one factory stage ran through the proxy and spend is above zero",
    test: stageRanThroughTheProxy,
    tryNext: "Ask Claude Code to run one stage with ANTHROPIC_BASE_URL set to the proxy.",
  },
  {
    says: "a request after the budget was spent was refused (evidence/refused.json)",
    test: requestAfterBudgetIsRefused,
    tryNext: "Ask Claude Code to send requests until the proxy answers budget_exceeded.",
  },
  {
    says: "no key appears in any file in the folder, apart from .env",
    test: noKeyInAnyFile,
    tryNext: "Search for sk- in the folder and move what you find into .env.",
  },
];

export default rules;
