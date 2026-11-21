# Lesson 5: The game loop and timing (Python)

Students learn how a Pygame game runs as a loop, why the screen and the snake keep different clocks, how the game keeps time fair when a computer is slow, and why the port needs its own way of rounding.

## Start by playing

Play the Park, level 2, in the Pygame window. The snake starts slowly and speeds up every 5 cowries. Watch the cowrie shell while you play. It pulses smoothly the whole time, even though the snake only jumps from cell to cell a few times a second.

## The Pygame loop

Every Pygame program runs a loop. The Python version's loop is at the end of `sankofa_snake/app.py`, in `run`:

```python
clock = pygame.time.Clock()
while game.running:
    dt_ms = clock.tick(60)
    for event in pygame.event.get():
        game.handle(event)
    game.update(dt_ms)
    game.draw(surf, pygame.time.get_ticks())
    pygame.display.flip()
```

Each pass through the loop is one frame, and it does four things in order.

1. `clock.tick(60)` waits until it's time for the next frame, so the loop runs at most 60 times a second. It returns how many milliseconds passed since the last frame.
2. `pygame.event.get()` collects every key press, click and window event since the last frame, and `handle` deals with each one.
3. `update` moves the snake if a move is due.
4. `draw` paints the whole picture into a hidden surface, and `flip` shows it in the window.

## Two clocks

The game runs on two clocks at once.

- The window draws a new picture up to 60 times a second. Each picture is a frame.
- The snake moves a set number of cells a second. The Park starts at 6 moves a second and rises to 10.

At 60 frames and 6 moves a second, the snake moves once every 10 frames or so. The frames in between redraw the same board, so the pulsing cowrie and the drifting currents stay smooth.

The rules give the length of one move in milliseconds with `move_ms` in `sankofa_snake/core/game.py`:

```python
def move_ms(state: GameState) -> float:
    return 1000 / speed_now(state)
```

`speed_now` is the snake's speed in moves a second. In slow motion it is 60% of the speed, rounded, and never below 3. While the snake swims along a current, the way the current flows, it is 1.5 times that, rounded. While it swims against a current, it is half that, rounded.

## Moving the snake

`update` in `app.py` decides how many moves are due:

```python
def update(self, dt_ms):
    if self.screen_name != "game" or not self.state or self.state.status != "running":
        return
    self.carry += min(dt_ms, 250)
    n = 0
    while n < 4 and self.carry >= move_ms(self.state) and self.state.status == "running":
        self.carry -= move_ms(self.state)
        nxt, events = tick(self.state)
        self.apply(nxt, events)
        n += 1
```

Read it a line at a time.

1. `dt_ms` is how long since the last frame, usually about 16.7 milliseconds.
2. `carry` saves up that time, like coins in a jar.
3. While the jar holds enough time for a whole move, the loop takes that much out and moves the snake one cell with `tick`.
4. Whatever is left stays in the jar for the next frame. Nothing is lost, so over a second the snake makes exactly as many moves as its speed says.

## Keeping time fair on a slow computer

A busy computer can miss frames, and dragging the window can stop the loop for a moment. Two limits stop that from spoiling the run.

- `min(dt_ms, 250)` never adds more than 250 milliseconds at once. If the window freezes for a moment, the snake doesn't jump a long way across the board when it comes back.
- The loop makes at most 4 moves in one frame. If the computer falls behind, the snake catches up over a few frames.

The game also pauses itself when the window loses focus, so switching to another window never costs the player a run.

## Rounding the JavaScript way

`speed_now` doesn't use Python's `round`. It uses a function the port defines itself:

```python
def js_round(x: float) -> int:
    """Rounds the way JavaScript's Math.round does: halves go up."""
    return math.floor(x + 0.5)
```

Python's `round` sends a number that ends in exactly .5 to the nearest even whole number, so `round(2.5)` is 2 and `round(3.5)` is 4. JavaScript's `Math.round` always sends .5 up, so it gives 3 and 4. The difference shows up in the game. The Ocean starts at 7 moves a second, and a current makes that 7 × 1.5 = 10.5. JavaScript rounds that to 11, and Python's `round` would give 10. The Python snake would swim slower than the web game's, and the reference tests would catch it.

## Time inside the rules

The time bonus at the end of a level depends on how long the run took. The rules don't read a clock for this. Each `tick` adds the length of the move to `elapsed_ms`:

```python
elapsed_ms = state.elapsed_ms + move_ms(state)
```

So a run's time counts only the moves the snake made. Time spent paused doesn't count, a slow computer gets the same time as a fast one for the same moves, and a test can check the time without waiting.

## Questions on paper

1. The snake moves 8 cells a second. How long is one move in milliseconds?
2. The window draws 60 frames a second and the snake moves 6 cells a second. About how many frames pass between two moves?
3. The snake's speed is 10. What is `speed_now` in slow motion? What if the speed is 4?
4. The window freezes for a whole second while the snake moves 8 cells a second. How many moves happen in the next frame, and why?
5. What do `round(10.5)` and `js_round(10.5)` give? Which one matches the web game?

## At the keyboard

Add these tests to `LessonTest` in `tests/test_lesson.py`.

1. The Farm moves 6 cells a second, so one move takes a sixth of a second:

   ```python
   def test_one_move_on_the_farm(self):
       game = create_game(LEVELS[0], 1)
       self.assertAlmostEqual(move_ms(game), 1000 / 6)
   ```

2. Ten moves add ten move lengths to the run's time:

   ```python
   def test_counts_the_run_time_in_moves(self):
       game = turn(create_game(LEVELS[0], 1), "up")
       for _ in range(10):
           game, _events = tick(game)
       self.assertAlmostEqual(game.elapsed_ms, 10 * 1000 / 6)
   ```

3. Write the loop yourself. Finish this function so that it plays frames of `frame_ms` milliseconds for one second and returns how many moves the snake made. Then check that it makes 6 moves at 60 frames a second, and still 6 at 30 frames a second.

   ```python
   def moves_in_one_second(frame_ms):
       game = turn(create_game(LEVELS[0], 1), "up")
       carry = 0.0
       moves = 0
       time = 0.0
       while time < 1000:
           # Add frame_ms to carry. While carry holds a whole move, take it out, tick, and count the move.
           time += frame_ms
       return moves
   ```

4. Write a test that checks `js_round(2.5)` is 3 while `round(2.5)` is 2. `js_round` lives in `sankofa_snake.core.game`, so import it from there.

## Notes for the teacher

1. 1000 / 8 = 125 milliseconds.
2. About 10. A frame takes 1000 / 60, about 16.7 milliseconds, and a move takes 1000 / 6, about 166.7.
3. 6, since 10 × 0.6 = 6. At speed 4, 4 × 0.6 = 2.4 rounds to 2, which is below the floor of 3, so it is 3.
4. 2 moves. `update` adds at most 250 milliseconds, and a move takes 125, so the jar holds exactly two moves. Without the cap it would hold 8, and the snake would jump 8 cells at once.
5. `round(10.5)` is 10 and `js_round(10.5)` is 11. The web game gives 11, so `js_round` matches it.

For keyboard exercise 3, the body of the loop is:

```python
carry += frame_ms
while carry >= move_ms(game):
    carry -= move_ms(game)
    game, _events = tick(game)
    moves += 1
```

At 30 frames a second the snake moves on every fifth frame instead of every tenth, so the count is still 6. Ask students to try frames of 16, 17 and 20 milliseconds as well. The count stays at 6 because the leftover time stays in `carry` for the next frame. Then ask what would happen if the loop threw the leftover away and set `carry` back to 0 after each move.

A good extension is to compare this loop with the web game's, in [lesson 5 of the TypeScript guide](../05-game-loop-and-timing.md). The browser calls the web game once per frame, and the web game stops asking for frames while the snake isn't moving. The Pygame loop runs all the time, because the window has to keep handling events even while the game is paused.
