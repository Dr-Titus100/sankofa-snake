// Copies the web game's drawings, sounds and styles into the two ports, so they look and sound
// the same as the web game. Run it from the top of the repo after changing apps/web/src:
//
//   node ports/build-assets.mjs           writes the files listed below
//   node ports/build-assets.mjs --check   fails if any of them is out of date
//
// ports/pygame/sankofa_snake/assets/sankofa-logo.svg   the logo for the title screen and window icon
// ports/shiny/www/sankofa-logo.svg                     the same logo for the Shiny app
// ports/shiny/www/sankofa-board.js                     the board drawing, sounds and swipes from apps/web/src
// ports/shiny/www/sankofa-snake.css                    the web game's styles
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const check = process.argv.includes("--check");
const banner = (from) => `Made by ports/build-assets.mjs from ${from}. Do not edit by hand.`;

const logoBundle = await build({ entryPoints: [`${root}apps/web/src/logo.ts`], bundle: true, format: "esm", write: false });
const { sankofaLogo } = await import(`data:text/javascript;base64,${Buffer.from(logoBundle.outputFiles[0].text).toString("base64")}`);
const logo = sankofaLogo(512, "Sankofa Snake") + "\n";

const board = await build({
  stdin: {
    contents: [
      `export { draw, layoutFor } from "./apps/web/src/render";`,
      `export { Sound } from "./apps/web/src/sound";`,
      `export { sankofaLogo, KENTE } from "./apps/web/src/logo";`,
      `export { listenForSwipes, swipeDirection, inputKind } from "./apps/web/src/input";`,
    ].join("\n"),
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  globalName: "SankofaBoard",
  target: "es2020",
  minify: false,
  legalComments: "none",
  banner: { js: `// ${banner("apps/web/src/render.ts, sound.ts, logo.ts and input.ts")}` },
  write: false,
});

const css = `/* ${banner("apps/web/src/styles.css")} */\n${readFileSync(`${root}apps/web/src/styles.css`, "utf8")}`;

const files = {
  "ports/pygame/sankofa_snake/assets/sankofa-logo.svg": logo,
  "ports/shiny/www/sankofa-logo.svg": logo,
  "ports/shiny/www/sankofa-board.js": board.outputFiles[0].text,
  "ports/shiny/www/sankofa-snake.css": css,
};

let stale = 0;
for (const [path, text] of Object.entries(files)) {
  const full = `${root}${path}`;
  if (check) {
    let old = "";
    try {
      old = readFileSync(full, "utf8");
    } catch {}
    if (old !== text) {
      console.error(`${path} is out of date. Run: node ports/build-assets.mjs`);
      stale++;
    }
  } else {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
    console.log(`Wrote ${path}`);
  }
}
if (stale) process.exit(1);
if (check) console.log("The ports' copies of the web game's files are up to date.");
