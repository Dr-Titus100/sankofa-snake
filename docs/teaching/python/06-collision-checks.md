# Lesson 6: Collision checks (Python)

Students learn how the Python version decides whether the snake's next cell is safe, why the order of the checks matters, why the snake can follow its own tail, and why Python can use tuples as dict keys.

## Start by playing

Play the City, level 4, in the Pygame window and run into the edge. Then play the Market and run into a stall, and finally steer the snake into its own body. Each run ends with a different message. Now try something else on the Farm. Make a small loop and chase your own tail. A snake of four cells can go round a 2 by 2 square forever.

## One cell at a time

On every move, the head steps into one new cell. A collision check asks a single question about that cell: is anything already there? The snake never moves more than one cell in a move, so the game never needs to check the cells in between.

The checks live in `_move_once` in `sankofa_snake/core/game.py`. In order:

```python
outside = nx < 0 or ny < 0 or nx >= level["width"] or ny >= level["height"]
if outside and level["edges"] == "walls":
    return fail("wall")
nx, ny = wrap_cell((nx, ny), level)
nxt: Cell = (nx, ny)

if nxt in state.obstacles:
    return fail("obstacle")
vehicle = _vehicle_at(level, state.vehicles, nxt)
if vehicle:
    return fail("vehicle", vehicle)
```

1. **The edge.** A cell off the board ends the run on a level with walls. On a level that wraps, `wrap_cell` brings the head back in on the other side.
2. **Obstacles.** Stalls, buildings, benches, maze walls, canoes and looms are the keys of the dict `state.obstacles`. `nxt in state.obstacles` asks whether the cell is one of those keys.
3. **Vehicles.** `_vehicle_at` looks along each vehicle's lane for the head's cell.
4. **The snake itself**, which comes next.

The edge check has to come before `wrap_cell`. Once `wrap_cell` has moved the cell, it is back on the board, and the game can no longer tell that it was off the edge.

`fail` is a small function defined inside `_move_once`. It can see `nx` and `ny` from the function around it, so each check only has to say what the snake hit.

## Tuples as dict keys

The TypeScript version keeps obstacles as text keys such as `"7,12"`, because two JavaScript objects with the same numbers are still two different objects, and a `Set` can't find one from the other. Python doesn't have that problem. Two tuples with the same numbers are equal, and they give the same hash, the number a dict uses to find a key. So `(7, 12) in state.obstacles` finds the cell straight away, however many obstacles there are, and the Python version needs no text keys at all.

Python only allows this for values that can't change, such as numbers, strings and tuples. A list can't be a dict key, because changing the list later would change its hash and lose it inside the dict.

## Following your own tail

```python
eating = state.food is not None and nxt == state.food
tail_moves = not eating and state.grow == 0
body = state.snake[:-1] if tail_moves else state.snake
passes, power_up = state.passes, state.power_up
if nxt in body:
    if passes == 0:
        return fail("self")
    passes -= 1
```

On most moves the tail leaves its cell at the same moment the head arrives somewhere new. So the game checks the head against the body without its last cell, `state.snake[:-1]`. That is why the snake can chase its own tail.

`nxt in body` works on a tuple too, but differently from a dict. Python looks at the cells one at a time from the head, so a longer snake takes longer to check. A snake never grows past a few hundred cells, so this stays fast.

When the head lands on a cowrie, the tail stays put on that same move, so the snake is one cell longer straight away. The `grow` field can also hold extra cells for the snake to grow, and while it is above 0 the tail stays put on every move. Then the last cell counts, and running into it ends the run.

This check also handles the Lab's pass power-up. With a pass, the snake goes through its body once and keeps going.

## What a crash returns

Every failed check calls `_crash`, which returns a new state with `status="over"`, the cause and the cell where it happened. The Pygame app reads the cause to show the right message and the cell to draw a cross on the board. In practice mode `_crash` returns a state with `status="ready"`, so the snake stops and waits.

Vehicles move first, before the snake, on the same beat. A vehicle waits while the snake is in its way, so only the snake's head can ever hit a vehicle.

## Questions on paper

1. A snake of 4 cells has eaten nothing for a while. Its head is about to move into the cell where its tail is now. Does the run end? What if it ate a cowrie on the move before? What if `grow` is 1?
2. Why must the edge check come before `wrap_cell`?
3. The game checks obstacles before it checks the snake's body. Could a cell ever hold both? What does that tell you about whether this order matters?
4. Why can the Python version keep obstacles as `(7, 12)` tuples in a dict, when the TypeScript version needs `"7,12"` text?
5. `nxt in state.obstacles` and `nxt in body` look alike. How does Python do each one, and which gets slower as it grows?

## At the keyboard

Add these tests to `LessonTest` in `tests/test_lesson.py`.

1. An obstacle straight ahead ends the run. `replace` gives the Farm a single obstacle right in front of the head:

   ```python
   def test_crashes_into_an_obstacle_straight_ahead(self):
       game = create_game(LEVELS[0], 1)  # the Farm, facing right
       hx, hy = game.snake[0]
       game = replace(game, obstacles={(hx + 1, hy): None})
       game, _events = tick(turn(game, "right"))
       self.assertEqual(game.status, "over")
       self.assertEqual(game.crash, "obstacle")
   ```

2. A snake can chase its own tail. Build a snake of four cells in a 2 by 2 square, with the head about to step into the tail's cell:

   ```python
   def test_the_head_can_follow_the_tail(self):
       game = create_game(LEVELS[0], 1)
       game = replace(
           game,
           snake=((5, 5), (5, 6), (6, 6), (6, 5)),
           dir="up",
           last_step="up",
           food=(15, 15),
       )
       game, _events = tick(turn(game, "right"))
       self.assertEqual(game.status, "running")
       self.assertEqual(game.snake[0], (6, 5))
   ```

3. Copy the second test and add `grow=1` to the `replace` call. Predict what happens before you run it, then check your prediction.
4. In a Python shell, try `{[7, 12]: None}`. Read the error, then try `{(7, 12): None}`.

## Notes for the teacher

1. No, the run goes on, because the tail leaves its cell on the same move. Eating on the move before changes nothing. The cowrie added its cell on that move, so `grow` is still 0 and the tail moves away as usual. Only with `grow` at 1 does the tail stay, and then the run ends with `crash == "self"`. Keyboard exercise 3 checks this.
2. After `wrap_cell`, a cell off the right edge becomes a cell on the left edge, which is on the board. The check would never see it as outside.
3. No. The snake can never move into an obstacle, so the two never share a cell. The order still decides which message a player sees when two kinds of collision could happen, so read it carefully when you add a new kind.
4. Two Python tuples with the same numbers are equal and have the same hash, so a dict finds one from the other. Two JavaScript objects with the same numbers are different objects to a `Set`, so the web game turns each cell into text first.
5. For the dict, Python works out the tuple's hash and jumps straight to it, so it takes about the same time however many obstacles there are. For the tuple, Python compares the cells one by one, so it gets slower as the snake gets longer.

For keyboard exercise 3, the run ends with `crash == "self"`, because a snake with cells left to grow keeps its tail cell. Exercise 4 gives `TypeError: unhashable type: 'list'`.

A good extension is to ask students where they would add a new kind of obstacle, such as a puddle that only slows the snake down, and which checks it would need to come before or after.
