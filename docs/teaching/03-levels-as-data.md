# Lesson 3: Levels as data

Students learn how each level lives in a data file apart from the code, how a few characters can draw a whole map, and how the game checks data for mistakes.

## Start by playing

Play the Market, level 3, with `?layout=fixed` at the end of the game's address, and notice where the stalls stand. Then open `levels/03-market.json`.

## A level is a JSON file

JSON is a plain text format for data. It has objects in curly brackets, lists in square brackets, text in double quotes, and numbers. The Market's file starts like this:

```json
{
  "id": "market",
  "number": 3,
  "name": "Market",
  "world": "market",
  "challenge": "Market stalls block parts of the board. Steer around them.",
  "width": 20,
  "height": 20,
  "edges": "wrap",
  "speed": { "start": 7, "step": 1, "every": 5, "max": 11 },
  "goal": 20,
  "parSeconds": 55,
  "stars": [560, 620],
  "start": { "x": 5, "y": 10, "dir": "right", "length": 3 }
}
```

| Setting | What it means |
| --- | --- |
| `edges` | `"wrap"` brings the snake back on the other side, and `"walls"` ends the run at the edge |
| `speed` | moves per second at the `start`, going up by `step` after every `every` cowries, up to `max` |
| `goal` | cowries to clear the level |
| `parSeconds` | finish faster than this for a time bonus |
| `stars` | the scores for two stars and for three stars |
| `start` | where the head starts, which way it faces and how long the snake is |

## The map

The `map` is a list of text rows, one row of the board per line, one character per cell:

```text
"....................",
"..###....##....####.",
```

- `.` is an open cell.
- `#` is an obstacle: a stall in the Market, a building in the City, a reed wall in the Maze.
- `<`, `>`, `^` and `v` are currents in the Ocean that push the snake that way.

`obstacleKeys` in `packages/core/src/levels.ts` reads the map. It goes through every row and every character, and keeps the place of each `#` as text like `"2,1"` so the game can look it up quickly.

## A map is a template

Without `?layout=fixed`, the stalls stand somewhere new every run. `newLayout` in `packages/core/src/layout.ts` reads the map as a list of pieces: each group of `#` cells that touch side by side is one piece, and each straight line of current arrows is one current. It then places every piece at a random spot, keeping one open cell around it, and keeps the cells around the snake's start clear. Last, it checks that the snake can still reach every open cell from the start. If a layout fails that check, it tries again.

The Maze works differently. A level with `"layout": "maze"` gets a brand new maze. A random walk that never visits a cell twice carves it, and then the game opens it up so no corridor ends in a dead end.

## Why keep levels as data?

- A level designer can change a level without touching the rules.
- The same files can feed a Python or R version of the game later.
- A test can check every level file for mistakes before anyone plays it.

That last check is `validateLevel` in `levels.ts`. It returns a list of problems in plain words, such as "map row 4 has 19 cells, expected 20" or a snake that starts on an obstacle. A test in `packages/core/test/game.test.ts` runs it on every level.

## Questions on paper

1. How many stall cells does the Market have? Count the `#` characters in its map.
2. The Park's speed is `{ "start": 6, "step": 1, "every": 5, "max": 10 }`. How fast is the snake after 12 cowries?
3. Why does the game store an obstacle's place as text like `"2,1"` in a set, instead of searching the map every move?
4. Draw a 10 by 10 level on squared paper with a wall of obstacles across the middle and one gap in it. Write its `map` as 10 strings of 10 characters.
5. The Market's map has nine stalls in different sizes, from 2 cells up to 3 by 3. When the game moves them to new places, why does it keep one open cell around each stall?

## At the keyboard

1. Check your level from question 4 with the validator. In `packages/core/test/lesson.test.ts`:

   ```ts
   import { expect, it } from "vitest";
   import { LEVELS, validateLevel, type LevelDef } from "../src";

   const mine: LevelDef = {
     ...LEVELS[0],
     id: "mine",
     name: "My level",
     width: 10,
     height: 10,
     start: { x: 2, y: 2, dir: "right", length: 3 },
     map: [
       // your ten rows here
     ],
   };

   it("my level has no mistakes", () => {
     expect(validateLevel(mine)).toEqual([]);
   });
   ```

2. Break your level on purpose. Make one row too short, then move the start onto a `#`. Read the problems the validator reports.
3. Add your level to the game:
   - Save it as `levels/10-mine.json` with `"number": 10`.
   - Import it at the top of `packages/core/src/levels.ts` and add it to the end of the `LEVELS` list.
   - Run `npm run dev` and play it. Clear the nine levels before it, or use Practice, where every level is open.

## Notes for the teacher

1. 47 cells: eighteen in rows 2 and 3, eleven in rows 7 to 9, ten in rows 13 to 15, and eight in rows 16 and 17.
2. It speeds up at 5 and 10 cowries, so after 12 it moves at 8 moves a second.
3. Looking up a key in a set takes about the same time however many obstacles there are. Searching the map means checking many cells on every move.
4. Answers vary. Check that every row has exactly 10 characters, and that the start cell and the two cells behind it are open.
5. Two stalls that touch would make one bigger stall, and stalls that touch the edge or each other at a corner can close off a pocket of the board the snake can never reach. The gap keeps every open cell reachable. The check after placing the stalls catches any case the gap misses.

When students add a level to the game, the test that checks every level file picks it up with no extra work. Their map is a template too, so a wall with one gap won't stay a wall. Add `"layout": "fixed"` to the file to keep it exactly as drawn. A wall level with `"edges": "walls"` and a solid ring of `#` around the edge is a common first design. Point out that it needs no `#` border, because walls already end the run at the edge.
