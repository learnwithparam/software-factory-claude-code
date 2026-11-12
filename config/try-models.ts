// bun run models: one tiny call per role on the chosen provider. Prints role, provider, pass or fail, and cost.
// Never prints a key. In replay mode it reads the recorded reply, so it passes with no key.
import { ask } from "../checks/lib/llm";
import { provider, ROLES } from "./models";

const p = provider();
let fails = 0;
for (const role of ROLES) {
  try {
    const r = await ask(role, "Reply with the single word ok.", "ok?");
    const ok = /\bok\b/i.test(r.text);
    if (!ok) fails++;
    console.log(`models: ${role.padEnd(5)} provider ${p.padEnd(10)} ${ok ? "pass" : "fail"}  cost $${r.costUsd.toFixed(4)}`);
  } catch (e) {
    fails++;
    console.log(`models: ${role.padEnd(5)} provider ${p.padEnd(10)} fail  ${(e as Error).message.split("\n")[0]}`);
  }
}
console.log(fails ? `models: ${fails} role(s) failed. Check LLM_PROVIDER and the key in .env.` : `models: every role answers on ${p}.`);
process.exit(fails ? 1 : 0);
