# Sankofa Snake for Pygame

The full game in a window, written in Python with Pygame. It plays exactly like the web game. See [the ports README](../README.md) for how the rules are kept the same.

## Play

You need Python 3.10 or newer.

```sh
cd ports/pygame
python -m pip install -r requirements.txt
python -m sankofa_snake
```

- Arrow keys or W, A, S and D steer. You can also click or touch the arrow pad beside the board, or drag across the board.
- Space, P or Escape pauses. A tap on a touch screen pauses too. The game pauses when the window loses focus.
- M turns the sound off or on. The Sound button beside the board and on How to play is gold while the sound is on.
- On the menus, Tab and the arrow keys move between buttons, Enter presses one, and Escape goes back.
- `--seed 42` gives the same layouts and cowries every run. `--fixed` plays every level exactly as its file draws it.

Progress is saved in a small file on your computer: `%APPDATA%\sankofa-snake` on Windows, `~/Library/Application Support/sankofa-snake` on macOS and `~/.local/share/sankofa-snake` on Linux. Set `SANKOFA_SNAKE_HOME` to keep it somewhere else. The file holds the same data as the web game keeps in the browser, and How to play has the Reset progress button.

## What's where

```text
sankofa_snake/core/       the rules, ported from packages/core
sankofa_snake/app.py      the screens, the controls and the game loop
sankofa_snake/render.py   the board, drawn the way apps/web/src/render.ts draws it
sankofa_snake/paints.py   the vehicle and canoe colors
sankofa_snake/sound.py    each world's instrument, made in code like the web game's sounds
sankofa_snake/progress.py saved progress, checked on the way in like the web game's
sankofa_snake/text.py     every word the game shows
tests/                    the reference runs and the app's own tests
```

## Tests

```sh
cd ports/pygame
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy python -m unittest discover -s tests
```

`test_reference.py` replays every recorded run from the TypeScript rules. `test_app.py` opens the game without a screen and checks the menus, the keys, the arrow pad, swipes, pausing, saving and the sounds.
