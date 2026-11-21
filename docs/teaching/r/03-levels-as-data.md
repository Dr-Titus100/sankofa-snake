# Lesson 3: Levels as data (R)

Students learn how each level lives in a data file apart from the code, how R reads it into nested lists, how a few characters can draw a whole map, and how the game checks data for mistakes.

## Start by playing

Start the Shiny app, add `?layout=fixed` to the end of its address, and play the Market, level 3. Notice where the stalls stand. Then open `levels/03-market.json` at the top of the repo. The web game, the Python version and the R version all read this same file.

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

`load_levels` in `R/levels.R` reads every file whose name starts with a number:

```r
files <- sort(list.files(dir, pattern = "^[0-9]+-.*\\.json$", full.names = TRUE))
levels <- lapply(files, function(f) jsonlite::read_json(f, simplifyVector = FALSE))
```

`jsonlite::read_json` turns the text into R values. With `simplifyVector = FALSE`, a JSON object becomes a named list and a JSON list becomes an unnamed list, so `LEVELS[[3]]$speed$max` is 11. Left to simplify, jsonlite would turn some lists into vectors or data frames, and the shape would depend on the data. Keeping plain lists means every level has the same shape as its file.

## The map

The `map` is a list of strings, one row of the board per string, one character per cell:

```text
"....................",
"..###....##....####.",
```

- `.` is an open cell.
- `#` is an obstacle, such as a stall in the Market, a building in the City or a reed wall in the Maze.
- `<`, `>`, `^` and `v` are currents in the Ocean that push the snake that way.

The R version reads the whole map at once, with vectors instead of loops. `map_cells` splits every row into characters and works out the `x` and `y` of each one:

```r
chars <- strsplit(unlist(rows), "")
ys <- rep(seq_along(chars) - 1L, lengths(chars))
xs <- unlist(lapply(chars, function(r) seq_along(r) - 1L))
list(x = xs, y = ys, ch = unlist(chars))
```

`obstacle_keys` then keeps the cells whose character is `#` and turns each one into text such as `"2,1"`:

```r
key <- function(x, y) if (length(x)) paste0(x, ",", y) else character(0)

obstacle_keys <- function(level) {
  m <- map_cells(level)
  hit <- m$ch == "#"
  key(m$x[hit], m$y[hit])
}
```

`m$ch == "#"` compares all 400 characters in one step and gives 400 `TRUE` or `FALSE` values. Indexing with them keeps only the matches. `paste0` works on whole vectors too, so `key` makes every obstacle's text in one call.

## A map is a template

Without `?layout=fixed`, the stalls stand somewhere new every run. `new_layout` in `R/layout.R` reads the map as a list of pieces. Each group of `#` cells that touch side by side is one piece, and each straight line of current arrows is one current. It places every piece at a random spot, keeping one open cell around it, and keeps the cells around the snake's start clear.

Last, it checks that the snake can still reach every open cell. `all_open_connected` does that with a flood fill, which starts at the snake's head and spreads to every open neighbour it hasn't seen yet. The R version marks cells in a logical matrix, one row per `x` and one column per `y`:

```r
seen <- matrix(FALSE, w, h)
seen[level$start$x + 1, level$start$y + 1] <- TRUE
stack <- list(c(level$start$x, level$start$y))
count <- 1
while (length(stack)) {
  p <- stack[[length(stack)]]
  stack[[length(stack)]] <- NULL
  for (d in SIDES) {
    nx <- p[1] + d[1]
    ny <- p[2] + d[2]
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) next
    if (seen[nx + 1, ny + 1] || grid[nx + 1, ny + 1]) next
    seen[nx + 1, ny + 1] <- TRUE
    count <- count + 1
    stack[[length(stack) + 1]] <- c(nx, ny)
  }
}
count == open
```

Every `+ 1` turns a cell that counts from 0 into a matrix position that counts from 1. If the fill reaches fewer cells than the board has open cells, the new layout has closed off part of the board, and `new_layout` tries again.

## Why keep levels as data?

- A level designer can change a level without touching the rules.
- The web game, the Python version and the R version all read the same files, so a change to a level reaches all three.
- A test can check every level file for mistakes before anyone plays it.

That last check is `validate_level` in `levels.R`. It returns a character vector of problems in plain words, such as `"map row 4 has the wrong number of cells"` or a snake that starts on an obstacle. An empty vector, `character(0)`, means the level is fine.

## Questions on paper

1. How many stall cells does the Market have? Count the `#` characters in its map.
2. The Park's speed is `{"start": 6, "step": 1, "every": 5, "max": 10}`. How fast is the snake after 12 cowries?
3. In the flood fill, what would happen without the check on `seen`?
4. Draw a 10 by 10 level on squared paper with a wall of obstacles across the middle and one gap in it. Write its `map` as 10 strings of 10 characters.
5. The flood fill writes `seen[nx + 1, ny + 1]`. What would go wrong without the `+ 1` for a cell in column 0?

## At the console

1. Check your level from question 4 with the validator. `modifyList` copies the Farm's settings and replaces the ones you name:

   ```r
   test_that("my level has no mistakes", {
     mine <- modifyList(LEVELS[[1]], list(
       id = "mine",
       name = "My level",
       width = 10,
       height = 10,
       start = list(x = 2, y = 2, dir = "right", length = 3),
       map = list(
         # your ten rows here, as strings separated by commas
       )
     ))
     expect_equal(validate_level(mine), character(0))
     expect_true(all_open_connected(mine))
   })
   ```

2. Break your level on purpose. Make one row too short, then move the start onto a `#`. Print what `validate_level` returns each time.
3. Close the gap in your wall with `mine$map[[5]] <- "##########"` (or whichever row holds your wall) and check that `all_open_connected` now returns `FALSE`.
4. Count the Market's stall cells with code, using `length(obstacle_keys(LEVELS[[3]]))`, and check your answer to question 1. Then try `table(map_cells(LEVELS[[3]])$ch)`.

## Notes for the teacher

1. 47 cells, eighteen in rows 2 and 3, eleven in rows 7 to 9, ten in rows 13 to 15, and eight in rows 16 and 17.
2. It speeds up at 5 and 10 cowries, so after 12 it moves at 8 moves a second.
3. The fill would keep adding the same cells to the stack, going back and forth between two neighbours forever.
4. Answers vary. Check that every row has exactly 10 characters, and that the start cell and the two cells behind it are open.
5. Column 0 would become matrix position 0. `seen[0, y]` selects nothing and gives `logical(0)`, an empty vector, so the `if` stops with an error. R 4.3 reports it as "missing value where TRUE/FALSE needed".

In exercise 1, the start `(2, 2)` facing right puts the body on `(1, 2)` and `(0, 2)`, so those cells must be open too. `modifyList` merges nested lists, so `modifyList(mine, list(start = list(x = 2, y = 4)))` keeps the start's `dir` and `length`. That's handy for exercise 2. In exercise 4, `table` counts every character in the map, the dots included.

R finds every numbered file in `levels/`, so a level saved as `levels/10-mine.json` would load in the R version with no code change. The web game also needs it listed in `packages/core/src/levels.ts`. That difference is worth a short discussion about automatic discovery and explicit lists.
