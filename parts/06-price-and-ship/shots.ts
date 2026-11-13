// bun parts/06-price-and-ship/shots.ts: capture the pictures of Part 6.
// Terminal output is rendered as HTML in a dark terminal style, 800 pixels wide, and screenshotted
// with Playwright's Chromium, the same way images/capture.ts does it.
// A live run cannot run again without spending, so its picture comes from the console it saved.
// The supervisor may move these shots into the SHOTS list of images/capture.ts.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const ROOT = join(import.meta.dir, "..", "..");
const PART = "parts/06-price-and-ship";
type Shot = {
  out: string;
  command: string;
  cmd?: string[];
  cwd?: string;
  savedOutput?: string[];
};

const SHOTS: Shot[] = [
  {
    out: `${PART}/01-route-models-by-stage/images/expected.png`,
    command: "bun run factory 2 --dry-run --json > /dev/null",
    cmd: ["bun", "run", "factory", "2", "--dry-run", "--json"],
    cwd: `${PART}/01-route-models-by-stage/solution`,
  },
];

const STYLE = [
  "body{margin:0;background:#0d1117;",
  "font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e6edf3}",
  ".bar{background:#161b22;padding:8px 12px;display:flex;gap:6px}",
  ".dot{width:11px;height:11px;border-radius:50%;background:#30363d}",
  "pre{margin:0;padding:12px 16px;white-space:pre-wrap;word-break:break-word}",
  ".prompt{color:#79c0ff}",
].join("\n");

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Lines the learner sees in the terminal, without the "$ " line bun prints
// and without Claude Code's one-line note about an untrusted folder (README explains it).
function visibleLines(output: string): string {
  const lines = output.split("\n");
  const shown = lines.filter((line) => !line.startsWith("$ ") && !line.startsWith("Ignoring "));
  return shown.join("\n").trimEnd();
}

function outputOf(shot: Shot): string {
  if (shot.savedOutput) {
    const outputs = shot.savedOutput.map((path) => readFileSync(join(ROOT, path), "utf8"));
    return outputs.join("\n");
  }
  // A dry run writes into a throwaway folder, so the picture leaves no runs/ behind.
  const runsFolder = mkdtempSync(join(tmpdir(), "shots-"));
  const finished = Bun.spawnSync(shot.cmd ?? [], {
    cwd: join(ROOT, shot.cwd ?? "."),
    // biome-ignore lint/style/useNamingConvention: the factory contract names this variable.
    env: { ...process.env, FACTORY_RUNS: runsFolder },
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(runsFolder, { recursive: true, force: true });
  // The factory prints its progress on stderr; with --json, stdout holds only the result.
  // Show the throwaway folder as runs/, where a learner's own run writes.
  return finished.stderr.toString().replace(/\S*shots-\w+/g, "runs");
}

function terminalPage(shot: Shot): string {
  const dots = '<span class="dot"></span>'.repeat(3);
  const prompt = `<span class="prompt">$ ${escapeHtml(shot.command)}</span>`;
  const body = escapeHtml(visibleLines(outputOf(shot)));
  const head = `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head>`;
  return `${head}<body><div class="bar">${dots}</div><pre>${prompt}\n${body}</pre></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const shot of SHOTS) {
    const viewport = { width: 800, height: 120 };
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    await page.setContent(terminalPage(shot));
    await page.screenshot({ path: join(ROOT, shot.out), fullPage: true });
    console.log(`shots: wrote ${shot.out}`);
    await page.close();
  }
} finally {
  await browser.close();
}
