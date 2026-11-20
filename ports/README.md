# Sankofa Snake in Python and R

Two more versions of the game, built on the same rules and the same level files as the web game:

- [`pygame/`](pygame/README.md) runs in a window on Windows, macOS and Linux with Python and Pygame.
- [`shiny/`](shiny/README.md) runs in a browser from R with Shiny.

Both play exactly like the web game at [titusnyarkonde.com/games/sankofa-snake](https://titusnyarkonde.com/games/sankofa-snake/): the nine levels, the daily challenge, free play and practice, new layouts every run with safe road crossings, power-ups, currents, trotros and taxis in shuffled colors, stars, streaks, the gold Sound switch, Reset progress and a sound for every event in each world's own instrument.

## How they stay the same as the web game

The rules live in TypeScript in `packages/core`. Each port has its own copy in its own language, written line by line from that code:

| Rules | Python | R |
| --- | --- | --- |
| `packages/core/src/rng.ts` | `pygame/sankofa_snake/core/rng.py` | `shiny/R/rng.R` |
| `packages/core/src/levels.ts` | `pygame/sankofa_snake/core/levels.py` | `shiny/R/levels.R` |
| `packages/core/src/game.ts` | `pygame/sankofa_snake/core/game.py` | `shiny/R/game.R` |
| `packages/core/src/layout.ts` | `pygame/sankofa_snake/core/layout.py` | `shiny/R/layout.R` |
| `packages/core/src/modes.ts` | `pygame/sankofa_snake/core/modes.py` | `shiny/R/modes.R` |

Nobody copies the levels by hand. Both ports read the files in `levels/` at the top of the repo, so a change to a level reaches all three games.

`reference/make-fixtures.mjs` plays 61 runs with the TypeScript rules, from every level, practice, free play, the daily challenge and the levels as their files draw them, and saves each run's seed, key presses and the state after every move in `reference/fixtures.json`. It also saves 225 layouts, 60 daily challenges and the vehicle colors for every road layout. The Python and R tests replay all of it and check every move, so a port that passes plays the same game, move for move. The same seed gives the same layout and the same cowries in all three, and the daily challenge is the same everywhere on the same date.

After a change to the rules, record the runs again and run both ports' tests:

```sh
node ports/reference/make-fixtures.mjs
```

`build-assets.mjs` copies the logo into the Pygame version, and the board drawing, sounds, swipes and styles from `apps/web/src` into the Shiny app. Run it after a change to the web game's look or sound:

```sh
node ports/build-assets.mjs
```

CI runs both scripts with `--check`, so a stale copy fails the build.
