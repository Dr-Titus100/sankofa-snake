# Lesson 3: Levels as data (Python)

Students learn how each level lives in a data file apart from the code, how Python reads it into a dict, how a few characters can draw a whole map, and how the game checks data for mistakes.

## Start by playing

Run `python -m sankofa_snake --fixed` from `ports/pygame` and play the Market, level 3. Notice where the stalls stand. Then open `levels/03-market.json` at the top of the repo. The web game, the Python version and the R version all read this same file.

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

`load_levels` in `sankofa_snake/core/levels.py` reads every file whose name starts with a number:

```python
files = sorted(p for p in folder.glob("*.json") if re.match(r"^\d+-", p.name))
levels = [json.loads(p.read_text(encoding="utf-8")) for p in files]
```

`json.loads` turns the text into Python values. A JSON object becomes a dict, a list becomes a list, and text becomes a string, so `LEVELS[2]["speed"]["max"]` is 11. The port keeps each level as a plain dict, shaped exactly like its file.

## The map

The `map` is a list of strings, one row of the board per string, one character per cell:

```text
"....................",
"..###....##....####.",
```

- `.` is an open cell.
- `#` is an obstacle, such as a stall in the Market, a building in the City or a reed wall in the Maze.
- `<`, `>`, `^` and `v` are currents in the Ocean that push the snake that way.

`obstacle_keys` reads the map with two loops and `enumerate`, which gives each item's position along with the item:

```python
def obstacle_keys(level: dict) -> dict[tuple[int, int], None]:
    keys: dict[tuple[int, int], None] = {}
    for y, row in enumerate(level.get("map") or []):
        for x, ch in enumerate(row):
            if ch == "#":
                keys[(x, y)] = None
    return keys
```

The result is a dict whose keys are the obstacle cells. The values are all `None`, because only the keys matter. A Python set would hold the same cells, but a set doesn't promise any order. A dict keeps its keys in the order they went in, the way a `Set` does in TypeScript. The next step places pieces in that order, so the order has to match the web game for the same seed to give the same layout.

## A map is a template

Without `--fixed`, the stalls stand somewhere new every run. `new_layout` in `sankofa_snake/core/layout.py` reads the map as a list of pieces. Each group of `#` cells that touch side by side is one piece, and each straight line of current arrows is one current. It places every piece at a random spot, keeping one open cell around it, and keeps the cells around the snake's start clear.

Last, it checks that the snake can still reach every open cell. `all_open_connected` does that with a flood fill, which starts at the snake's head and spreads to every open neighbour it hasn't seen yet:

```python
seen = {first}
stack = [first]
while stack:
    x, y = stack.pop()
    for dx, dy in SIDES:
        nx, ny = x + dx, y + dy
        k = (nx, ny)
        if nx < 0 or ny < 0 or nx >= width or ny >= height or k in seen or k in blocked:
            continue
        seen.add(k)
        stack.append(k)
return len(seen) == open_count
```

If the fill reaches fewer cells than the board has open cells, the new layout has closed off part of the board, and `new_layout` tries again.

## Why keep levels as data?

- A level designer can change a level without touching the rules.
- The web game, the Python version and the R version all read the same files, so a change to a level reaches all three.
- A test can check every level file for mistakes before anyone plays it.

That last check is `validate_level` in `levels.py`. It returns a list of problems in plain words, such as `"map row 4 has 19 cells, expected 20"` or a snake that starts on an obstacle. An empty list means the level is fine.

## Questions on paper

1. How many stall cells does the Market have? Count the `#` characters in its map.
2. The Park's speed is `{"start": 6, "step": 1, "every": 5, "max": 10}`. How fast is the snake after 12 cowries?
3. In the flood fill, what would happen without `k in seen`?
4. Draw a 10 by 10 level on squared paper with a wall of obstacles across the middle and one gap in it. Write its `map` as 10 strings of 10 characters.
5. Why does the port keep obstacles in a dict instead of a set?

## At the keyboard

1. Check your level from question 4 with the validator. `{**LEVELS[0], ...}` copies the Farm's settings and replaces the ones you name:

   ```python
   def test_my_level_has_no_mistakes(self):
       mine = {
           **LEVELS[0],
           "id": "mine",
           "name": "My level",
           "width": 10,
           "height": 10,
           "start": {"x": 2, "y": 2, "dir": "right", "length": 3},
           "map": [
               # your ten rows here
           ],
       }
       self.assertEqual(validate_level(mine), [])
       self.assertTrue(all_open_connected(mine))
   ```

2. Break your level on purpose. Make one row too short, then move the start onto a `#`. Print what `validate_level` returns each time.
3. Close the gap in your wall and check that `all_open_connected` now returns `False`. Then count by hand how many cells the flood fill reaches from the start.
4. Count the Market's stall cells with code instead of by hand: `len(obstacle_keys(LEVELS[2]))`.

## Notes for the teacher

1. 47 cells, eighteen in rows 2 and 3, eleven in rows 7 to 9, ten in rows 13 to 15, and eight in rows 16 and 17.
2. It speeds up at 5 and 10 cowries, so after 12 it moves at 8 moves a second.
3. The fill would keep adding the same cells to the stack, going back and forth between two neighbours forever.
4. Answers vary. Check that every row has exactly 10 characters, and that the start cell and the two cells behind it are open.
5. A dict keeps the cells in the order the map lists them, and a set doesn't promise any order. The layout code goes through the obstacles in order, so a set could give a different layout from the web game for the same seed, and the daily challenge would look different in the two versions.

In exercise 1, the start `(2, 2)` facing right puts the body on `(1, 2)` and `(0, 2)`, so those cells must be open too. With the wall across row 4 and the start at row 2, `all_open_connected` returns `True` while there's a gap and `False` without one. In exercise 2, a row of 9 cells gives `"map row 3 has 9 cells, expected 10"` if it's the fourth row.

Python finds every numbered file in `levels/`, so a level saved as `levels/10-mine.json` would load in the Python version with no code change. The web game also needs it listed in `packages/core/src/levels.ts`. That difference is worth a short discussion about automatic discovery and explicit lists.
