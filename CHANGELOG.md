# Changelog

## Unreleased

- TRADEMARKS.md keeps the name "Sankofa Snake", the bird logo and the store art for the official game. The code stays under the MIT license.
- ART.md records how every drawing and sound was made.
- The build works on Windows and in folders with spaces in their names.
- The release workflow builds with read-only access in one job and publishes in another.
- Dependabot and CodeQL watch the packages, the code and the workflows. `.npmrc` is gone, since installs work without `legacy-peer-deps`.

## 0.6.2 (2026-11-19)

- Copies of the game on one page, or in two browser tabs, now load each other's saved progress and switches. Before, turning Sound off on one copy could write over scores or cleared levels saved by another.

## 0.6.1 (2026-11-19)

- The button that leaves a run now says Back, whichever way you were playing.
- On How to play, the Back button is a plain button and no longer starts out selected.
- A page can show the game without its How to play button, with `data-sankofa-snake="play"`, and show only the rules and the sound and vibration switches, with `data-sankofa-snake="help"`. The website uses these to put How to play on a tab of its own.

## 0.6.0 (2026-11-19)

- Sound: short wooden notes for cowries, power-ups, currents, crashes and cleared levels. Each cowrie in a run plays the next note up a five-note scale. The browser makes the sounds, so the game loads no sound files.
- Vibration: a short buzz on phones that support it when the snake eats, crashes or clears a level.
- Off switches for sound and vibration on the How to play screen, a Sound switch next to Pause, and the M key. The game remembers the choice.
- Teaching guides in `docs/teaching`: four lessons with questions, exercises and notes for the teacher.
- The daily challenge says "road traffic" for worlds with trotros and taxis.

## 0.5.0 (2026-11-19)

- Daily challenge: the date picks a world, its edges, a pace and whether power-ups appear. Everyone gets the same challenge and the same cowries that day. Clearing it on days in a row builds a streak.
- Free play: the classic game in any world you have opened, with wrap-around edges or walls, until the snake crashes. The game keeps your best cowrie count for each world and edge choice.
- Practice: every level at a slower, steady speed. Running into something stops the snake instead of ending the run.
- The level list has tabs for Levels, Free play and Practice.

## 0.4.0 (2026-11-19)

- Level 8, Ocean: currents push the snake one square the way their arrows point when it swims across them. Swimming along a current does nothing. Fishing canoes float in the way.
- Level 9, Weaving village: walls, looms, trotros, taxis, currents and power-ups all at once, at the fastest speed in the game.
- When a current pushes the snake into something, the message after the crash says so.
- All nine levels from the plan are now in the game.

## 0.3.0 (2026-11-19)

- Level 6, Lab: power-ups appear on the board for a short time. Slow motion (a gold hourglass) slows the snake down for 40 moves, shrink (red arrows) takes four cells off the tail, and a pass (a green loop) lets the snake through its own tail once.
- Level 7, Maze: narrow corridors between walls of woven reeds, with power-ups to help.
- A line under the score shows how much slow motion is left and whether the snake has a pass.
- Screen readers hear when a power-up appears and what it does when the snake picks it up.

## 0.2.0 (2026-11-19)

- Level 4, City: the edge of the board is a solid wall, and buildings stand in blocks with streets between them.
- Level 5, Road: trotros and taxis drive along three roads. They stop for the snake, so the run ends only if the snake's head runs into one.
- The message after a crash names what the snake hit, such as a building or a taxi.
- Walled levels have a red line inside the kente frame.

## 0.1.1 (2026-11-19)

- Every button turns kente gold under the pointer, including Choose a level and How to play.
- Clearer wording on the title screen, the help screen and the level list.

## 0.1.0 (2026-11-19)

The first playable version, for the web.

- Three levels: Farm (learn the controls), Park (the snake speeds up) and Market (stalls block the way).
- A snake made of woven kente blocks, cowrie shells to collect, and the Sankofa bird as the logo.
- Arrow keys, W, A, S and D, and swipes on a phone. Space, P, Escape or a tap pauses.
- Best scores and up to three stars per level, saved in the browser.
- Screen readers hear the score, and the game pauses when the tab is hidden.
