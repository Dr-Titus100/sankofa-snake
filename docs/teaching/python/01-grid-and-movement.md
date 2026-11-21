# Lesson 1: The grid and how the snake moves (Python)

Students learn how the Python version stores the board and the snake, how one move works, and how the snake comes back on the other side of the board.

## Start by playing

Run `python -m sankofa_snake` from `ports/pygame` and play the first level, the Farm, for a few minutes. Steer the snake off the right edge of the board and watch where it comes back. Then try the City, where the edge is a wall.

## The board is a grid

The board is a grid of square cells, 20 across and 20 down in most levels. Every cell has two numbers:

- `x` counts across from the left, starting at 0.
- `y` counts down from the top, starting at 0.

So the top left cell is `(0, 0)` and the bottom right cell of a 20 by 20 board is `(19, 19)`. In maths class `y` usually grows upward. On screens it grows downward, because screens draw from the top.

The Python version keeps a cell as a tuple of two numbers. `sankofa_snake/core/game.py` gives the shape a name:

```python
Cell = tuple[int, int]
```

A tuple can't change after you make it, which suits a cell. The cell `(5, 10)` stays `(5, 10)`, and a move makes a new tuple for the new head.

## The snake is a tuple of cells

The snake is a tuple of cells with the head first. When the Farm starts, the snake is three cells long, facing right, with its head at `(5, 10)`:

```python
((5, 10), (4, 10), (3, 10))
```

One move has two steps:

1. Add a new head one cell ahead of the old head.
2. Remove the last cell, the tail.

The snake looks like it slides forward, but the cells in the middle never change. When the head lands on a cowrie, the game skips step 2, so the snake grows by one cell.

Find this in `_move_once` in `sankofa_snake/core/game.py`:

```python
tail_moves = not eating and state.grow == 0
body = state.snake[:-1] if tail_moves else state.snake
...
snake = (nxt,) + tuple(body)
```

`state.snake[:-1]` is a slice. It makes a new tuple with every cell except the last one. `(nxt,)` is a tuple holding only the new head, and `+` joins two tuples into a new one. The comma matters. Without it, `(nxt)` is just `nxt`.

## Which way is ahead?

The game keeps a small dict of steps, one for each direction:

```python
STEP = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
```

The new head is the old head plus the step:

```python
hx, hy = state.snake[0]
nx, ny = hx + STEP[step][0], hy + STEP[step][1]
```

The first line unpacks the head tuple into two names. Going up subtracts 1 from `y`, because `y` counts down from the top.

## Wrapping around the edge

On the Farm, a snake that leaves the right edge at `x = 20` comes back at `x = 0`. The remainder operator `%` does this. `20 % 20` is 0, and `21 % 20` is 1.

Going off the left edge gives `x = -1`. In JavaScript, `-1 % 20` is `-1`, so the web game adds the width and takes the remainder a second time. Python's `%` gives an answer with the same sign as the number on its right, so `-1 % 20` is already 19, the rightmost column. The Python version needs only this:

```python
def wrap_cell(c: Cell, level: dict) -> Cell:
    return (c[0] % level["width"], c[1] % level["height"])
```

This is the first of several places where the port had to allow for a difference between Python and JavaScript. Lines that look identical in two languages can still behave differently, so a port needs the most care on exactly those lines.

## Questions on paper

1. The Farm's snake starts at `(5, 10)`, `(4, 10)`, `(3, 10)`, facing right. Write down its cells after three moves to the right with no cowries.
2. The head is at `(19, 4)` on a 20 by 20 Farm, moving right. Where is the head after the next move?
3. Work out `x % 20` in Python for `x = -1`, `x = 7` and `x = 20`. Which of the three gives a different answer in JavaScript?
4. Why does the game ignore a turn straight back the way the snake is heading?
5. What is the difference between `(nxt,)` and `(nxt)`? What would go wrong in `_move_once` without the comma?

## At the keyboard

1. Open a Python shell and type `-1 % 20`. Then type `import math` and `math.fmod(-1, 20)`. Which one behaves like JavaScript's `%`?
2. Add this test to `LessonTest` in `tests/test_lesson.py` (see [Getting ready](README.md#getting-ready)) and run it:

   ```python
   def test_wraps_around_the_top_of_the_farm(self):
       game = create_game(LEVELS[0], 1)
       game = turn(game, "up")
       for _ in range(11):
           game, _events = tick(game)
       self.assertEqual(game.snake[0], (5, 19))
   ```

   Explain why 11 moves up from row 10 end in row 19. `tick` returns two things, the new state and a list of events, so the loop unpacks them.
3. Write a second test for question 1. Turn right, tick three times, and check the whole snake with `assertEqual`. Compare it with a tuple of three tuples.

## Notes for the teacher

1. `(8, 10)`, `(7, 10)`, `(6, 10)`. The middle cell of the new snake is a cell that was never part of the old one, which surprises some students. Ask them to draw it.
2. `(0, 4)`.
3. 19, 7 and 0. JavaScript gives `-1` for the first one.
4. The cell straight behind the head is the snake's neck, so the turn would end the run at once. The game drops that turn instead. The check is in `turn` in `game.py`.
5. `(nxt,)` is a tuple with one cell in it. `(nxt)` is just the cell, because the brackets only group. Without the comma, `nxt + tuple(body)` would try to add a cell to a tuple of cells and give a tuple whose first two items are numbers, `(x, y, (x1, y1), ...)`, instead of a snake.

At the keyboard, `math.fmod(-1, 20)` gives `-1.0`, the same sign as JavaScript. The head goes from row 10 to row 0 in 10 moves, and the 11th move goes to row -1, which wraps to row 19. A common mistake is to expect row 20.
