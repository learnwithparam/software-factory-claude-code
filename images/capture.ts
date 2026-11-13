// bun run shots: capture every picture the READMEs show, from the real app and the real command
// output. Pages are screenshotted from the running app. Terminal output is rendered as HTML in a
// dark terminal style about 800 pixels wide, then screenshotted. Needs Playwright's Chromium:
//   bunx playwright install chromium   (or set CHROMIUM_PATH to an installed Chromium)
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = join(import.meta.dir, "..");
type Shot = { out: string[]; page?: string; cmd?: string[]; cwd?: string; title?: string };

export const SHOTS: Shot[] = [
  { out: ["00-orientation/images/catalogue.png", "images/catalogue.png"], page: "/" },
  {
    out: [
      "00-orientation/images/replay-issue-2.png",
      "images/finished-system.png",
      "parts/00-meet-the-library/01-meet-the-library/images/expected.png",
    ],
    cmd: ["bun", "run", "finished", "2", "--replay"],
  },
  {
    out: ["parts/01-write-the-work-order/01-write-the-issue-form/images/expected.png"],
    cmd: ["bun", "run", "verify", "write-the-issue-form", "solution"],
  },
  {
    out: ["parts/01-write-the-work-order/02-size-the-backlog/images/expected.png"],
    cmd: ["bun", "run", "verify", "size-the-backlog", "solution"],
  },
];

const TERMINAL_STYLE = [
  "body{margin:0;background:#0d1117;",
  "font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e6edf3}\n",
  ".bar{background:#161b22;padding:8px 12px;display:flex;gap:6px}",
  ".dot{width:11px;height:11px;border-radius:50%;background:#30363d}\n",
  "pre{margin:0;padding:12px 16px;white-space:pre-wrap;word-break:break-word}",
  ".prompt{color:#79c0ff}\n",
].join("");
const WINDOW_DOT = '<span class="dot"></span>';
const WINDOW_BAR = `<div class="bar">${WINDOW_DOT.repeat(3)}</div>`;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Turn the few ANSI colours our scripts use into spans.
function ansiToHtml(text: string): string {
  const colors: Record<string, string> = { "31": "#ff6b6b", "32": "#69db7c", "2": "#8b949e" };
  let open = 0;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes start with ESC.
  const html = escapeHtml(text).replace(/\x1b\[(\d+)m/g, (_match, code) => {
    if (code === "0") {
      const close = "</span>".repeat(open);
      open = 0;
      return close;
    }
    open++;
    return `<span style="color:${colors[code] ?? "inherit"}">`;
  });
  return html + "</span>".repeat(open);
}

function terminalPage(command: string[], output: string): string {
  const prompt = `<span class="prompt">$ ${escapeHtml(command.join(" "))}</span>`;
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>\n${TERMINAL_STYLE}</style></head>` +
    `<body>${WINDOW_BAR}\n<pre>${prompt}\n${ansiToHtml(output.trimEnd())}</pre></body></html>`
  );
}

// The command's output as a learner sees it, without the "$ " lines our scripts echo.
function commandOutput(shot: Shot, command: string[]): string {
  const finished = Bun.spawnSync(command, {
    cwd: shot.cwd ?? ROOT,
    // biome-ignore lint/style/useNamingConvention: environment variables are upper case.
    env: { ...process.env, FORCE_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const lines = finished.stdout.toString().split("\n");
  return lines.filter((line) => !line.startsWith("$ ")).join("\n");
}

async function capture(page: Page, shot: Shot): Promise<void> {
  if (shot.page) await page.goto(`http://localhost:${port}${shot.page}`);
  else if (shot.cmd) await page.setContent(terminalPage(shot.cmd, commandOutput(shot, shot.cmd)));
  for (const outPath of shot.out) {
    mkdirSync(dirname(join(ROOT, outPath)), { recursive: true });
    await page.screenshot({ path: join(ROOT, outPath), fullPage: true });
    console.log(`shots: wrote ${outPath}`);
  }
}

const APP_VIEWPORT = { width: 1100, height: 400 };
const TERMINAL_VIEWPORT = { width: 800, height: 120 };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const port = 3199;
const server = Bun.spawn(["bun", join(ROOT, "world/app/src/server.ts")], {
  // biome-ignore lint/style/useNamingConvention: environment variables are upper case.
  env: { ...process.env, PORT: String(port) },
  stdout: "pipe",
});
await Bun.sleep(800);
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: shot.page ? APP_VIEWPORT : TERMINAL_VIEWPORT,
      deviceScaleFactor: 2,
    });
    await capture(page, shot);
    await page.close();
  }
} finally {
  server.kill();
  await browser.close();
}
