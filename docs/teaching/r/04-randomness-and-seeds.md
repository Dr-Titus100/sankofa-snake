# Lesson 4: Randomness and seeds (R)

Students learn where a computer's random numbers come from, what a seed is, how the R version does 32-bit arithmetic in a language whose numbers are doubles, how a closure keeps its own state, and how the daily challenge gives every player the same board in every version of the game.

## Start by playing

Open the Shiny app twice, in two browser tabs, with `?seed=7` at the end of the address. The first cowrie lands in the same place in both, and on the Market the stalls stand in the same places too. Then try `?seed=8`. The web game with `?seed=7` shows the same board as the Shiny app.

## Computers fake randomness

A computer follows instructions exactly, so it can't pick a truly random number by itself. Instead it uses a formula that turns one number into the next, and the numbers that come out look random. This is a pseudo-random number generator. The number it starts from is the seed.

The same seed always gives the same numbers in the same order. The game depends on this:

- The tests check exact cowrie positions, so they need the same cowries on every run.
- The daily challenge needs every player to get the same board on the same day.
- A replay of a run needs the cowries to land where they did the first time.

## The generator in the game

`R/rng.R` holds a small generator called mulberry32, the same one the web game uses. Students don't need to follow every bit operation inside it. They only need its shape:

```r
next_random(state) # returns list(value = ..., state = ...)
```

You give it the generator's state, and it gives back a number from 0 up to (but never reaching) 1, plus the state to use next time. The game keeps that state in `state$rng`, so it travels with the rest of the run.

`place_food` in `game.R` uses it to pick a cowrie's cell:

```r
r <- next_random(state$rng)
i <- floor(r$value * length(cells$x)) + 1
state$food <- c(cells$x[i], cells$y[i])
state$rng <- r$state
```

`cells` holds the empty cells as two vectors. Multiplying the random value by the number of cells and rounding down gives a position from 0, and `+ 1` turns it into an R index. Every empty cell has the same chance.

## 32-bit numbers in R

The generator comes from JavaScript, where the bit operations work on 32-bit whole numbers that are never negative. R has two kinds of numbers, and neither fits.

- R's integers are 32 bits but signed, so the biggest is 2,147,483,647, about half of what the generator needs. `bitwXor` and the other bit functions only work on these.
- R's ordinary numbers are doubles. A double holds whole numbers exactly only up to 2^53, so multiplying two 32-bit numbers, which can need 64 bits, loses the last digits.

So the port keeps each 32-bit value as a double and splits it into two 16-bit halves whenever it needs a bit operation or a multiplication:

```r
xor32 <- function(a, b) {
  bitwXor(as.integer(a %/% 65536), as.integer(b %/% 65536)) * 65536 +
    bitwXor(as.integer(a %% 65536), as.integer(b %% 65536))
}
```

`a %/% 65536` is the top 16 bits and `a %% 65536` is the bottom 16 bits. Each half fits easily in an R integer, so `bitwXor` can work on it, and the two results go back together afterward. `imul32` multiplies the halves separately for the same reason, so no step ever needs more than 53 bits.

## A stream of numbers

`daily_level` needs several random numbers in a row. Passing the state along by hand every time would be untidy, so `rand_stream` returns a function that remembers it:

```r
rand_stream <- function(seed) {
  state <- u32(seed)
  function() {
    r <- next_random(state)
    state <<- r$state
    r$value
  }
}
```

The inner function is a closure. It keeps the `state` from the call that made it, and `<<-` updates that remembered `state` instead of making a new local one. Each call to the inner function gives the next number.

## Why not R's own `set.seed`?

R has a seed too. `set.seed(7)` followed by `runif(1)` gives the same number every time. It uses a different generator, the Mersenne Twister by default, so it would give different numbers from the web game for the same seed. It also keeps its state in a hidden variable, `.Random.seed`, where the game state can't carry it.

## The daily challenge

`seed_from(text)` turns any text into a seed. `daily_level(date)` in `R/modes.R` feeds it the date and then draws from a stream to pick a world, solid walls or wrap-around edges, a pace and whether power-ups appear:

```r
r <- rand_stream(seed_from(paste0("sankofa-daily:", date)))
base <- LEVELS[[floor(r() * length(LEVELS)) + 1]]
edges <- if (r() < 0.5) "walls" else "wrap"
```

Everyone in the world who plays on that date runs the same steps and gets the same answer, in TypeScript, Python or R, with no server involved.

## Questions on paper

1. `floor(r$value * 300) + 1` picks an index in a list of 300 open cells. What index do you get for a value of 0, 0.5 and 0.999? Can it ever give 301?
2. Give two reasons the game keeps the generator's state inside the game state instead of calling `runif()`.
3. Two friends open the daily challenge on the same date, one in Accra and one in Boise. Do they get the same challenge? In the Shiny version, R runs on a server that may sit in a third time zone. Look at what `www/app.js` sends as `today`.
4. Why can't the port just write `bitwXor(a, b)` on two 32-bit values?

## At the console

1. Call the generator three times, passing the state along each time. Run the test twice and check you get the same numbers both times:

   ```r
   test_that("gives the same numbers from the same seed", {
     numbers <- numeric(0)
     state <- 1
     for (i in 1:3) {
       r <- next_random(state)
       numbers <- c(numbers, r$value)
       state <- r$state
     }
     print(numbers)
     expect_equal(numbers[1], 0.6271, tolerance = 1e-4)
   })
   ```

2. Find out which world the daily challenge picks for your birthday this year with `daily_level("YYYY-MM-DD")$name`, and print its `challenge`.
3. Check that the generator is fair. Make a stream with `r <- rand_stream(5)`, draw 10,000 numbers with `replicate(10000, r())`, and count how many fall in each tenth with `table(floor(x * 10))`. Each count should be close to 1,000.
4. At the console, try `bitwXor(4294967295, 1)` and read the warning. Then try `xor32(4294967295, 1)`.

## Notes for the teacher

1. Indexes 1, 151 and 300. It can never give 301, because the value is always less than 1, so the largest is `floor(299.7) + 1`, which is 300, the last cell.
2. `runif` uses a different generator, so the cowries wouldn't match the web game or the daily challenge in the other versions. And its state lives in `.Random.seed`, so two games at once, a replay or a test would all disturb each other's numbers.
3. They get the same challenge only when their dates match. The browser works out `today` from the player's own clock and sends it to R, so the server's time zone doesn't matter. For a few hours each day Accra is already on the next date while Boise is not. Each date's challenge is the same for everyone who plays it.
4. 4294967295 is bigger than R's largest integer, so `as.integer` turns it into `NA` with a warning, and the result is `NA`. Splitting into 16-bit halves keeps every piece in range.

At the console, the first number from seed 1 is about 0.62707. In exercise 4, `xor32(4294967295, 1)` gives 4294967294. For exercise 3, students with some statistics can go further with `chisq.test(table(floor(x * 10)))`. With nine degrees of freedom, a statistic above about 16.9 would be surprising at the 5% level. A good generator should pass most of the time, and fail about one time in twenty. This is a good moment to run the same test on `runif(10000)` and compare.
