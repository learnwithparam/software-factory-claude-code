// bun parts/02-teach-the-repo/capture.ts: capture the pictures this part's steps show.
// Each picture is the real output of a command, rendered as a dark terminal about 800 pixels wide.
// It works like images/capture.ts; add these shots to its SHOTS list to keep one capture script.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const ROOT = join(import.meta.dir, "..", "..");
type Shot = { out: string; command: string[] };

const SHOTS: Shot[] = [
  {
    out: "parts/02-teach-the-repo/01-trim-the-agents-file/images/expected.png",
    command: ["bun", "run", "verify", "trim-the-agents-file", "solution"],
  },
  {
    out: "parts/02-teach-the-repo/03-package-the-triage-skill/images/expected.png",
    command: ["bun", "run", "verify", "package-the-triage-skill", "solution"],
  },
];

const STYLE = [
  "body{margin:0;background:#0d1117;color:#e6edf3;",
  "font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}",
  ".bar{background:#161b22;padding:8px 12px;display:flex;gap:6px}",
  ".dot{width:11px;height:11px;border-radius:50%;background:#30363d}",
  "pre{margin:0;padding:12px 16px;white-space:pre-wrap;word-break:break-word}",
  ".prompt{color:#79c0ff}.pass{color:#69db7c}.fail{color:#ff6b6b}",
].join("");

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// PASS lines in green and FAIL lines in red, as a learner's terminal shows them.
function colourLine(line: string): string {
  const safeLine = escapeHtml(line);
  if (/^\s+PASS\b/.test(line)) return `<span class="pass">${safeLine}</span>`;
  if (/^\s+FAIL\b/.test(line)) return `<span class="fail">${safeLine}</span>`;
  return safeLine;
}

function terminalPage(command: string[], output: string): string {
  const prompt = `<span class="prompt">$ ${escapeHtml(command.join(" "))}</span>`;
  const outputLines = output.trimEnd().split("\n");
  const lines = outputLines.map(colourLine).join("\n");
  const dots = '<span class="dot"></span>'.repeat(3);
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head>` +
    `<body><div class="bar">${dots}</div><pre>${prompt}\n${lines}</pre></body></html>`
  );
}

// The command's output without the "$ bun scripts/..." line that bun run echoes.
function commandOutput(command: string[]): string {
  const finished = Bun.spawnSync(command, { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const lines = finished.stdout.toString().split("\n");
  return lines.filter((line) => !line.startsWith("$ ")).join("\n");
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: 800, height: 120 },
      deviceScaleFactor: 2,
    });
    await page.setContent(terminalPage(shot.command, commandOutput(shot.command)));
    mkdirSync(dirname(join(ROOT, shot.out)), { recursive: true });
    await page.screenshot({ path: join(ROOT, shot.out), fullPage: true });
    await page.close();
    console.log(`capture: wrote ${shot.out}`);
  }
} finally {
  await browser.close();
}
