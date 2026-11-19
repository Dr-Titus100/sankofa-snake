# Sankofa Snake

A free snake game in kente colors. You steer a snake of woven kente blocks to collect cowrie shells, and each level adds a new world and one new rule. The logo is the Sankofa bird, the Akan symbol of a bird that turns its head back to pick up an egg from its back.

Play it at [titusnyarkonde.com/games/sankofa-snake](https://titusnyarkonde.com/games/sankofa-snake/).

## Levels

| Level | World | What's new |
| --- | --- | --- |
| 1 | Farm | Learn the controls. The edges wrap around and the speed stays the same. |
| 2 | Park | The snake speeds up after every 5 cowries. |
| 3 | Market | Market stalls block parts of the board. |
| 4 | City | Solid walls. Hitting the edge of the board ends the run. |
| 5 | Road | Trotros and taxis drive across the board. They stop for the snake, so only the snake's head can hit one. |
| 6 | Lab | Power-ups appear for a short time. Slow motion slows the snake down, shrink makes it shorter, and a pass lets it through its own tail once. |
| 7 | Maze | Narrow corridors with little room to turn. |
| 8 | Ocean | Currents push the snake one square sideways when it swims across them. |
| 9 | Weaving village | Every challenge at once: walls, looms, trotros, currents and power-ups, at top speed. |

Eat 20 cowries to clear a level and open the next one. Clearing a level earns one star, and a high score with a fast finish earns up to two more.

## Other ways to play

The daily challenge changes every day. The date picks a world, its edges, a pace and whether power-ups appear, and the cowries start in the same places for everyone that day. Clear it on days in a row to build a streak.

Free play is the classic game in any world you have opened, with wrap-around edges or walls. It has no goal and goes on until the snake crashes. The game keeps your best cowrie count for each world.

Practice opens every level at a slower, steady speed. Running into something only stops the snake until you pick a new direction, so it works well for a class demo.

## Controls

- Arrow keys or W, A, S and D steer. On a phone, swipe.
- Space, P or Escape pauses. On a phone, tap the board.
- M turns the sound off or on. The How to play screen has switches for sound and for vibration on phones that support it.
- The game pauses on its own when you switch tabs or apps.

## Sound and vibration

Each event has a short sound: a cowrie, a power-up, a current, a crash and a cleared level. The notes are modeled on the gyil, a wooden xylophone from the Upper West of Ghana, and each cowrie in a run plays the next note up a five-note scale. The browser makes the sounds with the Web Audio API, so the game loads no sound files. On phones that support it, eating, crashing and clearing a level also give a short buzz.

## Teaching

The [teaching guides](docs/teaching/README.md) use the game's code to teach programming, with questions on paper, exercises at the keyboard and notes for the teacher. There are four lessons: the grid and how the snake moves, rules as functions, levels as data, and randomness and seeds.

## Where the code lives

```text
packages/core/   the rules in TypeScript, with no drawing, and their unit tests
levels/          one data file per level: size, edges, speed, goal and obstacles
apps/web/        the canvas game, its styles and its browser tests
scripts/         the build script
docs/teaching/   lesson guides with exercises
```

The rules and the drawing live in separate folders on purpose. `packages/core` decides where the snake goes, what it eats and when a run ends. `apps/web` only draws the board and reads the keyboard and touch screen. The same rules will run the phone apps later.

A level is a data file. The Market's stalls, for example, are the `#` characters in `levels/03-market.json`, and the Road's trotros and taxis are listed under `vehicles` in `levels/05-road.json`, each with its lane, direction, length and speed. Currents are the arrows `<`, `>`, `^` and `v` in the Ocean's map. The Lab's `powerUps` setting says which power-ups can appear, how often and for how long. Adding a level means adding a file and listing it in `packages/core/src/levels.ts`. A test checks every level file for mistakes, such as a snake that starts on an obstacle.

The cowries land in random places, but the random numbers come from a seed. The same seed always gives the same game, which the tests and the daily challenge rely on. Add `?seed=42` to the game's address to try it.

## Working on it

You need Node.js 22 and Python 3 (the browser tests use Python's small web server).

```sh
npm install
npm test            # unit tests for the rules
npm run build       # builds dist/
npm run test:e2e    # plays the built game in a desktop and a phone browser
npm run dev         # rebuilds on every change at http://localhost:5173
```

`npm run build` writes four files to `dist/`: `sankofa-snake.js`, `sankofa-snake.css`, `sankofa-logo.svg` and a stand-alone `index.html`, plus `SHA256SUMS`. To put the game on any page, load the script and the stylesheet and add an element with a `data-sankofa-snake` attribute:

```html
<link rel="stylesheet" href="sankofa-snake.css" />
<div data-sankofa-snake></div>
<script type="module" src="sankofa-snake.js"></script>
```

Give the attribute the value `play` to leave out the How to play button, or `help` to show only the rules and the sound and vibration switches. A site can use the two to put the rules on a tab of their own, the way titusnyarkonde.com does.

## Releases

The release workflow tests and builds the game, then attaches the built files to a GitHub release. Pushing a tag such as `v0.1.1` starts it. You can also start it by hand from the Actions tab with the tag name, and it creates the tag for you. The website pins one release and checks each file's checksum before it serves the game.

## Privacy

The game keeps scores, progress and the daily streak in your browser's local storage. It sends nothing to any server and has no ads or trackers.

## Credits

This game started from a snake game Titus built in R Shiny, which grew out of [Adam Spannbauer's shiny_snake_loader](https://github.com/AdamSpannbauer/shiny_snake_loader) (MIT license). Sankofa Snake is a fresh rewrite and shares no code with it.

The game draws the kente patterns and the Sankofa bird in code. They draw on kente cloth and Adinkra symbols from Ghana and don't copy any named cloth design.

## License

MIT. See [LICENSE](LICENSE).
