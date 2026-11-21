# Teaching with Sankofa Snake in Python

These guides teach programming with the Pygame version of the game, in `ports/pygame`. They follow the same six lessons as the [TypeScript guides](../README.md), but every code sample comes from the Python port, and every exercise runs with Python's own `unittest`. Each lesson also points out where Python behaves differently from JavaScript, because the port had to deal with each of those differences.

The lessons suit students who have written a little Python before. They work for an upper secondary class, a first university course or a coding club.

## The lessons

| Lesson | What students learn | Time |
| --- | --- | --- |
| [1. The grid and how the snake moves](01-grid-and-movement.md) | Cells as tuples, the snake as a tuple of cells, and how Python's `%` handles negative numbers | 45 minutes |
| [2. Rules as functions](02-rules-as-functions.md) | A frozen dataclass for the game state, functions that return a new state, and unit tests | 60 minutes |
| [3. Levels as data](03-levels-as-data.md) | JSON files as dicts, maps made of characters, and a flood fill that checks the snake can reach every cell | 60 minutes |
| [4. Randomness and seeds](04-randomness-and-seeds.md) | Pseudo-random numbers, seeds, 32-bit arithmetic in a language with unlimited integers, and the daily challenge | 45 minutes |
| [5. The game loop and timing](05-game-loop-and-timing.md) | The Pygame loop, frames and moves as two clocks, and why the port needs its own rounding | 45 minutes |
| [6. Collision checks](06-collision-checks.md) | Checking one cell a move, the order of the checks, and tuples as dict keys | 45 minutes |

Each lesson has questions to answer on paper, exercises at the keyboard, and notes for the teacher with the answers.

## Getting ready

Students need Python 3.10 or newer and a copy of the repository.

```sh
git clone https://github.com/Dr-Titus100/sankofa-snake.git
cd sankofa-snake/ports/pygame
python -m pip install -r requirements.txt
python -m sankofa_snake
```

The last line opens the game in a window. The rules in `sankofa_snake/core` don't need Pygame, so students can do every exercise even if Pygame won't install.

Students write their tests in a new file, `ports/pygame/tests/test_lesson.py`, that starts like this:

```python
import sys
import unittest
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sankofa_snake.core import *  # noqa: E402,F403


class LessonTest(unittest.TestCase):
    pass
```

Each exercise adds a method to `LessonTest`. To run only that file, from `ports/pygame`:

```sh
python -m unittest discover -s tests -p test_lesson.py
```

The port's own tests run with `python -m unittest discover -s tests`. On a computer with no screen, put `SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy` in front of that command.

## Using the game in class

- Practice mode suits demonstrations. The snake moves slowly, and running into something only stops it, so you can steer while you talk without the run ending.
- `python -m sankofa_snake --seed 42` puts the cowries, stalls, roads and currents in the same places for everyone. `--fixed` plays every level exactly as its file draws it.
- M turns the sound off, which helps in a quiet room.
- Students with the web game open in a browser can compare it with the Python version side by side. The same seed gives the same board in both.

## Project ideas

- Write a simple computer player in Python that steers toward the cowrie, and measure how often it clears each level. Because the rules don't need Pygame, it can play thousands of runs in a few seconds.
- Keep a record of every move in a run and replay it afterward. The seed and the list of turns, each with the move it came on, are enough to replay a whole run.
- Read `tests/test_reference.py`, which replays 61 runs recorded from the TypeScript rules. Add a check of your own to it, such as the score after every move.
- Pick one exercise from these lessons and write it again in TypeScript, using the [TypeScript guides](../README.md). Compare the two versions line by line and list what each language made easier.
