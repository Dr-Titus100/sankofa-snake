# Lesson 2: Rules as functions (Python)

Students learn how the Python version keeps everything about a run in one value, how each rule is a function that returns a new value, and how that makes the rules easy to test.

## Start by looking at the folders

```text
sankofa_snake/core/   the rules: where the snake goes, what it eats, when a run ends
sankofa_snake/app.py  the screens, the keyboard and mouse, and the game loop
sankofa_snake/render.py and sound.py   the drawing and the sounds
```

Nothing in `sankofa_snake/core` imports Pygame, draws anything or reads a key. The Pygame window and the unit tests both use the same rules from this folder.

## Everything about a run is one value

`GameState` in `sankofa_snake/core/game.py` holds the whole run. It is a dataclass:

```python
@dataclass(frozen=True)
class GameState:
    level: dict
    snake: tuple[Cell, ...]
    dir: str
    last_step: str
    queue: tuple[str, ...]
    food: Optional[Cell]
    ...
    status: str
    rng: int
```

These are some of its fields:

| Field | What it holds |
| --- | --- |
| `snake` | the snake's cells, head first |
| `dir` | the way the snake is heading |
| `queue` | turns the player pressed that haven't happened yet |
| `food` | the cell with the cowrie on it |
| `eaten`, `score` | how many cowries so far, and the score |
| `status` | `"ready"`, `"running"`, `"paused"`, `"over"` or `"cleared"` |
| `rng` | where the random number generator has got to (lesson 4) |

`frozen=True` means nobody can change a field after the state exists. Writing `state.status = "paused"` raises an error. Every list inside it is a tuple for the same reason, because a tuple can't change either.

## Rules return a new state

Three functions do most of the work:

- `create_game(level, seed)` returns the state at the start of a level.
- `turn(state, d)` returns the state after the player presses a direction.
- `tick(state)` moves the snake one cell and returns a pair, `(state, events)`.

None of them changes the state you pass in. Each one builds a new state and returns it. The code does this with `replace` from the `dataclasses` module, which copies a dataclass and changes only the fields you name:

```python
return replace(state, status="paused")
```

This is the same idea as `{ ...state, status: "paused" }` in the TypeScript version.

The `events` list says what happened during the move, such as `{"type": "ate", ...}` or `{"type": "crash", "cause": "wall"}`. The Pygame app reads the events in `on_event` in `app.py` to play a sound for each one and to save your progress when a run ends. The rules never need to know about any of that.

## Why work this way?

A rule that only takes a value and returns a value is easy to test. A test can build a state, call the rule and check the result, with no window, no keyboard and no waiting.

It also means the old state is still there after a move. A replay, an undo button or a computer player that tries moves ahead all become simple. The port's own tests depend on this. `tests/test_reference.py` replays 61 runs recorded from the TypeScript rules and compares the state after every single move.

## Questions on paper

1. A snake is heading right and the player presses left. What should `turn` return, and why?
2. Practice mode stops the snake when it runs into something, where the normal game ends the run. Only one function in `game.py` changes for practice. Which one do you think it is? Find it and check.
3. Why might a game keep turns in a queue instead of using only the last key pressed? Think about pressing up and then right very quickly.
4. The state keeps the snake as a tuple. What could go wrong if it kept a list instead, even with `frozen=True`?

## At the keyboard

Add these tests to `LessonTest` in `tests/test_lesson.py`.

1. `turn` ignores a turn back into the neck. It hands back the very same state, which `assertIs` checks:

   ```python
   def test_ignores_a_turn_back_into_the_neck(self):
       start = create_game(LEVELS[0], 1)  # facing right
       after = turn(start, "left")
       self.assertIs(after, start)
       self.assertEqual(after.status, "ready")
   ```

2. Nobody can change a state by accident. Check that writing to a field raises an error:

   ```python
   def test_a_state_cannot_change(self):
       from dataclasses import FrozenInstanceError

       game = create_game(LEVELS[0], 1)
       with self.assertRaises(FrozenInstanceError):
           game.status = "paused"
   ```

3. A move leaves the old state alone. Keep the snake from before the move, call `tick`, and check that the old state's snake is still the same:

   ```python
   def test_leaves_the_old_state_alone(self):
       before = turn(create_game(LEVELS[0], 1), "up")
       snake = before.snake
       tick(before)
       self.assertEqual(before.snake, snake)
   ```

4. Write a test that runs the City (`LEVELS[3]`, where the edge is a wall) straight up until the run ends. Check that `status` is `"over"` and `crash` is `"wall"`. How many ticks does it take?

## Notes for the teacher

1. It returns the state you passed in, so nothing changes and the snake keeps going right. Turning left would put the head on the neck.
2. `_crash`. In practice it returns a state with `status="ready"` and a `bump`, so the game waits for a new direction.
3. With only the last key, a quick up then right would lose the up, and the snake would turn right without first going up. The queue keeps up to two turns, `MAX_QUEUED_TURNS`, so quick presses happen in order.
4. `frozen=True` stops you from putting a new value in a field, but a list inside the state could still change in place, for example with `state.snake.append(...)`. That would change the old state too. Tuples close that gap.

For keyboard exercise 3, ask students why the test passes even though `tick(before)` throws its result away. The answer is that `tick` never touches `before`. For exercise 4, the City's snake starts at row 10 in an open column. Ten moves reach row 0 and the 11th hits the wall, so it takes 11 ticks.

A good extension is to ask students to break a rule on purpose, for example by deleting the line in `turn` that checks for the neck, and watch which tests fail, both theirs and the ones in `tests/test_reference.py`. Then they undo the change.
