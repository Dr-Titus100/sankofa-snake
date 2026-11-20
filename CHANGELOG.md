# Changelog

## Unreleased

- The game now also comes for Python and R. `ports/pygame` plays it in a window with Pygame, and `ports/shiny` plays it in a browser with R Shiny. Both have the nine levels, the daily challenge, free play and practice, new layouts with safe road crossings, power-ups and currents, the arrow pad, each world's instrument, the gold Sound switch, shuffled trotro and taxi colors and Reset progress. They read the same level files as the web game, and their tests replay 61 runs recorded from the TypeScript rules and check every move.

## 0.9.1 (2026-11-20)

- Each run picks its own mix of trotro and taxi colors, so every color turns up over a few runs. 0.9.0 gave the vehicles the same colors in the same order every time, so the Road only ever showed gold, black and orange taxis and cream and green trotros. No two trotros and no two taxis on one board share a color, and the daily challenge gives everyone the same colors.

## 0.9.0 (2026-11-20)

- Each world has its own instrument. The Farm keeps the wooden gyil, the Park has a bamboo flute, the Market an iron bell, the City a guitar string, the Road a horn, the Lab a glass chime, the Maze a low log drum, the Ocean water drops, and the Weaving village the gyil and the bell together. The tunes stay the same.
- Trotros are painted cream, green, blue or silver, each with a kente band. Taxis are gold, black, orange, purple or teal, and a black taxi has a cream outline so it shows on the road. Every vehicle has a red light at each corner. No two trotros and no two taxis on one board share a color.
- The Market's stalls and the Lab's benches come in different sizes, from 2 cells up to 3 by 3, and a stall or bench several cells big is drawn as one piece.
- Every canoe in the Ocean has its own hull color: brown, blue, red, green or cream, with a gold or red stripe.
- Two new teaching lessons: the game loop and timing, and collision checks. Both come with questions, exercises and answers for the teacher.
- The README has a short gameplay clip, a diagram of how the parts fit, a tests badge and a table of what the tests cover. `npm run clip` records the clip again.

## 0.8.1 (2026-11-20)

- The Sound switch in the game bar is gold while the sound is on, the same as the switches on How to play. Sound starts on, and a tap turns it off.

## 0.8.0 (2026-11-20)

- Phones and tablets get arrow buttons under the board. The snake turns as soon as a finger touches an arrow, and swiping on the board still works. Turned sideways, the arrows sit beside the board with Pause, Sound and Back. Computers don't show them.
- Every run has a new layout. The Market's stalls, the City's buildings, the Lab's benches, the Ocean's canoes and currents, and the Weaving village's looms and currents land in new places, and the Maze is a new maze with no dead ends. Every part of a maze has at least two ways in, so a long snake never gets trapped in a loop. The snake's starting cells and the cells just ahead of it stay clear, and every open cell can be reached.
- On about half of the runs, roads cross each other on the Road and in the Weaving village. Vehicles stop for each other at crossings, the same way they stop for the snake, so they never crash. Parallel roads stay 4 cells apart, so vehicles waiting at a crossing never block each other for good.
- The daily challenge has one layout for everyone on the same date. `?seed=42` fixes the layout along with the cowries, and `?layout=fixed` plays every level exactly as its file draws it.
- Choosing a level near the bottom of a long page no longer leaves the page scrolled past the game. The game scrolls back to its top when the screen changes. A page with a sticky header can set `--ss-scroll-margin` to clear it.
- The rules and the start message on phones and tablets mention the arrow buttons.
- The ways-to-play tabs (Levels, Free play and Practice), the edge choice and the Sound and Vibration switches on How to play have the same solid edge as the other buttons. On a computer, the tabs turn gold under the pointer.

## 0.7.0 (2026-11-20)

- Saved progress is checked when it loads. Scores, stars, streaks and free play bests must be whole numbers in a sensible range, levels must be real levels, and anything else is dropped. A save edited to hold HTML can no longer run code, and a save with 9 stars no longer empties the level list.
- Every value put into the game's screens is escaped, including the logo's label.
- The save has a version number, so later releases can change its format without wiping progress. Saves from 0.6 load as they are.
- Reset progress on How to play deletes scores, stars, cleared levels, the streak and free play bests after a confirmation. The sound and vibration switches stay.
- The game says so when the browser won't let it save, as in some private windows.
- The board is drawn only while the snake moves. Waiting, paused and finished boards stay still, and the fixed scenery is drawn once per level. This saves battery on phones.
- An error on the board shows "Something went wrong" with a button back to the title, instead of a frozen board.
- `destroy()` removes a game from the page cleanly, and `back()` pauses a run and then goes back one screen at a time, for the Android back button in the phone apps. The script exports the `SankofaSnake` class, and each element keeps its game as `element.sankofaSnake`.
- On phones, the rules, the hint and the start message talk about swipes and taps, and leave out the keys. On computers they leave out swipes.
- On a phone turned sideways, the board sits beside the score and buttons, so Pause, Sound and Back stay on the screen.
- The How to play heading shows a focus ring when you reach it with the keyboard.
- The daily challenge shows the date in your browser's own format, and says that everyone gets the same challenge on the same date, which starts at midnight on your device.
- The game's own page has a Content Security Policy that blocks every network request, and a browser test fails if the game makes one.
- The browser tests also run in WebKit, the engine inside Safari on the iPhone.
- Swipes use pointer events, which work the same way for fingers, pens and mice. A mouse click on the board doesn't pause.
- All the game's text is in one file, `apps/web/src/text.ts`, ready for French or Twi later.

### Also in this release

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
