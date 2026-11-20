# Art and sound

Titus made every picture and sound in Sankofa Snake for this game, in code. The repo holds no image, sound or font files, and the game uses no stock art, icon packs or third-party assets.

| Part | How it's made | Where | First commit |
| --- | --- | --- | --- |
| Sankofa bird logo | Drawn as an SVG for this game | `apps/web/src/logo.ts` | 5c3edcc, 19 November 2026 |
| Kente board frame, woven snake blocks, cowries, scenery, vehicles, power-ups and currents | Drawn on a canvas with shapes and lines | `apps/web/src/render.ts` | 5c3edcc, 19 November 2026 |
| Notes, swishes and thuds | Made by the browser's Web Audio API from oscillators and filtered noise. No recordings | `apps/web/src/sound.ts` | 03ae4b0, 19 November 2026 |
| Text | The player's system font. No font files | `apps/web/index.html`, `apps/web/src/styles.css` | |

The build writes `dist/sankofa-logo.svg` from `logo.ts`, so it's the same drawing.

## Cultural sources

The game draws on traditional forms from Ghana: the Sankofa Adinkra symbol, kente cloth, cowrie shells and the gyil, a xylophone from the Upper West. They're the inspiration, and the drawings are new. The kente patterns follow how kente is woven, in strips of crossing bands, and don't copy any named cloth design. The bird is a new drawing of the Sankofa idea, a bird turning back to pick up an egg.

## Keeping the record

The git history shows when each drawing and sound first appeared and every change since. If you add sketches or design files later, put them in `docs/art/` with the date in the file name.
