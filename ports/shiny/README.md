# Sankofa Snake for R Shiny

This is the full game in a browser, run from R with Shiny. It plays exactly like the web game. [The ports README](../README.md) explains how the ports keep the rules the same.

## Play

You need R 4.1 or newer with the shiny and jsonlite packages.

```r
install.packages(c("shiny", "jsonlite"))
shiny::runApp("ports/shiny")
```

Then open the address Shiny prints. The controls are the same as on the website: the arrow keys or W, A, S and D steer, Space, P or Escape pauses and M turns the sound off or on. On a phone or tablet the arrow pad sits under the board, swipes steer and a tap pauses. Add `?seed=42` to the address for the same layouts and cowries every run, or `?layout=fixed` to play every level as its file draws it.

## How it works

R runs the game. The rules in `R/`, the layouts, the timing of every move, the screens, the scores and the daily streak all live on the R side. The browser only draws what R sends and sends back key presses, taps and swipes.

The drawing and the sounds come from the web game itself. `www/sankofa-board.js` is the board drawing, the sounds, the swipe handling and the logo from `apps/web/src`, and `www/sankofa-snake.css` is its stylesheet. `node ports/build-assets.mjs` copies both, so the board, the per-world instruments, the shuffled trotro and taxi colors and the gold Sound switch match the website exactly. `www/app.js` connects them to R.

Progress stays in the player's browser, in the same format the web game uses, and never on the server. R checks every saved value before it uses it.

The app finds the level files by looking for a `levels/` folder above it, so it runs straight from the repo. To put it on a server such as shinyapps.io, copy the `levels/` folder into `ports/shiny/` first, or set `SANKOFA_LEVELS` to its path.

## Tests

```sh
cd ports/shiny
Rscript -e 'testthat::test_dir("tests/testthat")'
```

`test-reference.R` replays every recorded run from the TypeScript rules. `test-server.R` runs the Shiny server without a browser and checks Play, the controls, crashes, practice, the daily challenge, Reset progress and saved progress.

## Teaching

The [R teaching guides](../../docs/teaching/r/README.md) use this version's code to teach programming in six lessons, with questions on paper, `testthat` exercises and notes for the teacher.
