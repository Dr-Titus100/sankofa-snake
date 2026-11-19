// Builds the web game into dist/:
//   sankofa-snake.js    the game, one file
//   sankofa-snake.css   its styles, all scoped to .ss-root
//   sankofa-logo.svg    the Sankofa bird
//   index.html          a page that runs the game on its own
// Run with --serve to rebuild on every change and serve dist/ at http://localhost:5173.
import { build, context } from "esbuild";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const dist = `${root}dist`;
const serve = process.argv.includes("--serve");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const options = {
  entryPoints: {
    "sankofa-snake": `${root}apps/web/src/main.ts`,
    "sankofa-snake-styles": `${root}apps/web/src/styles.css`,
  },
  outdir: dist,
  bundle: true,
  format: "esm",
  target: "es2020",
  minify: !serve,
  sourcemap: serve,
  legalComments: "none",
  logLevel: "info",
};

copyFileSync(`${root}apps/web/index.html`, `${dist}/index.html`);

// The logo file comes from the same drawing the game uses.
const logo = await build({ entryPoints: [`${root}apps/web/src/logo.ts`], bundle: true, format: "esm", write: false });
const { sankofaLogo } = await import(`data:text/javascript;base64,${Buffer.from(logo.outputFiles[0].text).toString("base64")}`);
writeFileSync(`${dist}/sankofa-logo.svg`, sankofaLogo(512, "Sankofa Snake") + "\n");

if (serve) {
  const ctx = await context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: dist, port: 5173 });
  console.log(`Serving dist/ at http://localhost:${port}`);
} else {
  await build(options);
  // esbuild names the stylesheet after its entry point. The release uses a simpler name.
  copyFileSync(`${dist}/sankofa-snake-styles.css`, `${dist}/sankofa-snake.css`);
  rmSync(`${dist}/sankofa-snake-styles.css`);
  const files = ["sankofa-snake.js", "sankofa-snake.css", "sankofa-logo.svg", "index.html"];
  const sums = files.map((f) => `${createHash("sha256").update(readFileSync(`${dist}/${f}`)).digest("hex")}  ${f}`);
  writeFileSync(`${dist}/SHA256SUMS`, sums.join("\n") + "\n");
  console.log(sums.join("\n"));
}
