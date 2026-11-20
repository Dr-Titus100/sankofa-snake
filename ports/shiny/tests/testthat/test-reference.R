# Checks that the R rules play exactly the same game as the TypeScript rules.
# The runs in ports/reference/fixtures.json were recorded from packages/core. Each one is replayed
# here with the same seed and the same key presses, and every move must give the same state.

fixtures <- jsonlite::read_json(file.path(app_dir, "..", "reference", "fixtures.json"), simplifyVector = FALSE)
by_id <- stats::setNames(LEVELS, vapply(LEVELS, function(l) l$id, character(1)))

cell_text <- function(x, y = NULL) {
  if (is.null(x)) return("-")
  if (is.null(y)) return(paste0(num(x[1]), ",", num(x[2])))
  paste0(num(x), ",", num(y))
}

layout_line <- function(level) {
  m <- paste(unlist(level$map), collapse = "/")
  vs <- paste(vapply(level$vehicles, function(v) {
    paste(c(v$kind, v$axis, num(v$lane), num(v$dir), num(v$length), num(v$every), num(v$start)), collapse = ",")
  }, character(1)), collapse = ";")
  s <- level$start
  paste0(m, "|", vs, "|", num(s$x), ",", num(s$y), ",", s$dir, ",", num(s$length))
}

state_line <- function(s) {
  p <- if (is.null(s$power_up)) "-" else paste0(s$power_up$kind, "@", num(s$power_up$x), ",", num(s$power_up$y), "<", num(s$power_up$until))
  paste(c(
    s$status, s$dir, s$last_step, paste(s$queue, collapse = ","),
    paste(cell_text(s$sx, s$sy), collapse = " "), cell_text(s$food),
    num(s$eaten), num(s$score), num(s$speed), num(s$speed_level), num(s$grow), num(floor(s$elapsed_ms)), num(s$moves),
    paste(num(s$vehicles), collapse = ","), p, num(s$slow_until), num(s$passes),
    if (is.null(s$crash)) "-" else s$crash, if (is.null(s$crash_vehicle)) "-" else s$crash_vehicle,
    if (is.null(s$bump)) "-" else s$bump, if (isTRUE(s$crash_pushed)) "1" else "0", cell_text(s$crash_at), num(s$rng)
  ), collapse = "|")
}

event_text <- function(e) {
  switch(e$type,
    ate = paste0("ate:", num(e$x), ",", num(e$y), ":", num(e$points)),
    speedup = paste0("speedup:", num(e$speed)),
    crash = paste0("crash:", e$cause),
    bump = paste0("bump:", e$cause),
    power = paste0("power:", e$kind),
    powerAppeared = paste0("powerAppeared:", e$kind, ":", num(e$x), ",", num(e$y)),
    current = paste0("current:", e$dir),
    cleared = paste0("cleared:", num(e$score), ":", num(e$stars), ":", num(e$timeBonus)),
    e$type
  )
}

hex8 <- function(n) paste0(sprintf("%04x", as.integer(n %/% 65536)), sprintf("%04x", as.integer(n %% 65536)))

level_for <- function(run) {
  if (run$mode == "daily") return(new_layout(daily_level(run$level), layout_seed(daily_seed(run$level))))
  base <- by_id[[run$level]]
  switch(run$mode,
    levels = new_layout(base, layout_seed(run$seed)),
    practice = new_layout(practice_level(base), layout_seed(run$seed)),
    free = new_layout(free_play_level(base, run$edges), layout_seed(run$seed)),
    base
  )
}

test_that("seeds and random numbers match", {
  for (item in fixtures$seeds) expect_equal(seed_from(item$text), item$seed)
  state <- 42
  for (pair in fixtures$randoms) {
    r <- next_random(state)
    expect_equal(r$value, pair[[1]])
    expect_equal(r$state, pair[[2]])
    state <- r$state
  }
})

test_that("layouts match", {
  for (item in fixtures$layouts) {
    made <- new_layout(by_id[[item$level]], item$seed)
    line <- layout_line(made)
    if (!is.null(item$line)) expect_equal(line, item$line, label = paste(item$level, item$seed))
    expect_equal(hex8(seed_from(line)), item$hash, label = paste(item$level, item$seed))
  }
})

test_that("daily challenges match", {
  for (item in fixtures$daily) {
    level <- daily_level(item$date)
    expect_equal(level$id, item$id)
    expect_equal(level$world, item$world)
    expect_equal(level$challenge, item$challenge)
    expect_equal(level$edges, item$edges)
    sp <- level$speed
    expect_equal(c(sp$start, sp$step, sp$every, sp$max), unlist(item$speed))
    pu <- level$powerUps
    got <- if (is.null(pu)) NULL else list(paste(unlist(pu$kinds), collapse = ","), pu$every, pu$lasts)
    if (is.null(item$powerUps)) expect_null(got) else expect_equal(unlist(got), unlist(item$powerUps))
    expect_equal(daily_seed(item$date), item$seed)
  }
})

test_that("every recorded run plays the same, move by move", {
  for (run in fixtures$runs) {
    level <- level_for(run)
    expect_equal(layout_line(level), run$layout, label = run$name)
    s <- create_game(level, run$seed)
    expect_equal(state_line(s), run$start, label = run$name)
    hashes <- substring(run$hashes, seq(1, nchar(run$hashes), 8), seq(8, nchar(run$hashes), 8))
    inputs <- strsplit(run$inputs, " ", fixed = TRUE)[[1]]
    line <- ""
    for (i in seq_along(inputs)) {
      for (p in strsplit(inputs[i], ",", fixed = TRUE)[[1]]) {
        if (!nzchar(p)) next
        s <- if (p == "pause") toggle_pause(s) else turn(s, p)
      }
      r <- tick(s)
      s <- r$state
      line <- paste0(state_line(s), "#", paste(vapply(r$events, event_text, character(1)), collapse = ";"))
      if (hex8(seed_from(line)) != hashes[i]) {
        fail(sprintf("%s: move %d differs: %s", run$name, i, line))
        break
      }
    }
    expect_equal(line, run$last, label = run$name)
  }
})
