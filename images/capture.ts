// bun run shots: capture every picture the READMEs show, from the real app and the real command output.
// Pages are screenshotted from the running app. Terminal output is rendered as HTML in a dark terminal
// style about 800 pixels wide, then screenshotted. Needs Playwright's Chromium:
//   bunx playwright install chromium   (or set CHROMIUM_PATH to an installed Chromium)
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Turn the few ANSI colours our scripts use into spans.
function ansiToHtml(text: string): string {
  const colors: Record<string, string> = { "31": "#ff6b6b", "32": "#69db7c", "2": "#8b949e" };
  let open = 0;
  const html = esc(text).replace(/\x1b\[(\d+)m/g, (_, code) => {
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

function terminalPage(cmd: string[], output: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0d1117;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e6edf3}
.bar{background:#161b22;padding:8px 12px;display:flex;gap:6px}.dot{width:11px;height:11px;border-radius:50%;background:#30363d}
pre{margin:0;padding:12px 16px;white-space:pre-wrap;word-break:break-word}.prompt{color:#79c0ff}
</style></head><body><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
<pre><span class="prompt">$ ${esc(cmd.join(" "))}</span>\n${ansiToHtml(output.trimEnd())}</pre></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const port = 3199;
const server = Bun.spawn(["bun", join(ROOT, "world/app/src/server.ts")], {
  env: { ...process.env, PORT: String(port) },
  stdout: "pipe",
});
await Bun.sleep(800);
try {
  for (const s of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: s.page ? 1100 : 800, height: s.page ? 400 : 120 },
      deviceScaleFactor: 2,
    });
    if (s.page) await page.goto(`http://localhost:${port}${s.page}`);
    else if (s.cmd) {
      const r = Bun.spawnSync(s.cmd, {
        cwd: s.cwd ?? ROOT,
        env: { ...process.env, FORCE_COLOR: "1" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const text = r.stdout
        .toString()
        .split("\n")
        .filter((l) => !l.startsWith("$ "))
        .join("\n");
      await page.setContent(terminalPage(s.cmd, text));
    }
    for (const o of s.out) {
      mkdirSync(dirname(join(ROOT, o)), { recursive: true });
      await page.screenshot({ path: join(ROOT, o), fullPage: true });
      console.log(`shots: wrote ${o}`);
    }
    await page.close();
  }
} finally {
  server.kill();
  await browser.close();
}
