# The R Shiny version of Sankofa Snake.
#
# R runs the game: the rules in R/game.R, the layouts, the timing of every move, the screens, the
# scores and the streak. The browser only draws what R sends, with the same drawing and sound code
# as the web game (www/sankofa-board.js, copied from apps/web/src by ports/build-assets.mjs), and
# sends back key presses, taps and swipes. Progress stays in the player's browser, as on the web.
#
# Run it from this folder with: R -e 'shiny::runApp()'
# Shiny loads every file in R/ before this one.

library(shiny)

`%||%` <- function(a, b) if (is.null(a)) b else a

h <- htmltools::tags
act_button <- function(label, act, arg = NULL, class = "ss-btn", ...) {
  h$button(class = class, type = "button", `data-act` = act, `data-arg` = arg, ..., label)
}

pad_html <- function() {
  arrows <- c(up = "M12 5 L20 17 H4 Z", down = "M12 19 L4 7 H20 Z", left = "M5 12 L17 4 V20 Z", right = "M19 12 L7 20 V4 Z")
  h$div(
    class = "ss-pad", role = "group", `aria-label` = TEXT$pad$label, `data-pad` = NA,
    lapply(c("up", "left", "right", "down"), function(d) {
      h$button(
        class = paste0("ss-pad-btn ss-pad-", d), type = "button", `data-dir` = d, `aria-label` = TEXT$pad[[d]],
        htmltools::HTML(sprintf('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="%s"/></svg>', arrows[[d]]))
      )
    })
  )
}

game_shell <- function() {
  hud <- TEXT$hud
  b <- TEXT$buttons
  h$div(
    class = "ss-screen ss-game", `data-screen` = "game", hidden = NA,
    h$div(
      class = "ss-hud",
      h$h2(class = "ss-hud-level", `data-hud` = "level"),
      h$dl(
        class = "ss-hud-stats",
        h$div(h$dt(hud$cowries), h$dd(`data-hud` = "eaten")),
        h$div(h$dt(hud$score), h$dd(`data-hud` = "score")),
        h$div(`data-hud-best` = NA, h$dt(hud$best), h$dd(`data-hud` = "best"))
      ),
      h$p(class = "ss-hud-power", `data-hud` = "power")
    ),
    h$div(
      class = "ss-stage", `data-stage` = NA,
      h$canvas(class = "ss-canvas", role = "img", `aria-label` = hud$board),
      h$div(class = "ss-overlay", `data-overlay` = NA)
    ),
    h$div(
      class = "ss-controls", `data-controls` = NA,
      h$div(
        class = "ss-actions ss-bar",
        h$button(class = "ss-btn", type = "button", `data-cmd` = "pause", b$pause),
        h$button(class = "ss-btn ss-toggle", type = "button", `data-setting` = "sound", `aria-pressed` = "true", b$sound),
        act_button(b$back, "leave")
      ),
      pad_html()
    ),
    h$p(class = "ss-note ss-hint", `data-hint` = NA)
  )
}

ui <- htmltools::tagList(
  h$head(
    h$meta(name = "viewport", content = "width=device-width, initial-scale=1"),
    h$title(TEXT$name),
    h$link(rel = "icon", href = "sankofa-logo.svg", type = "image/svg+xml"),
    h$link(rel = "stylesheet", href = "sankofa-snake.css"),
    h$style(htmltools::HTML(paste(
      "body { margin: 0; padding: 16px; min-height: 100vh; background: #0f0b0c;",
      "font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }",
      ".page-title { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }"
    ))),
    h$script(src = "sankofa-board.js"),
    h$script(src = "app.js")
  ),
  h$h1(class = "page-title", TEXT$name),
  h$main(
    h$div(
      class = "ss-root", `data-sankofa-root` = NA,
      h$div(class = "ss-screen", `data-screen` = "menu", uiOutput("screen")),
      game_shell(),
      h$p(class = "ss-sr", `aria-live` = "polite", `data-live` = NA)
    )
  )
)

server <- function(input, output, session) {
  # Everything about the run lives here. Only the screen and the redraw counter are reactive.
  game <- new.env()
  game$state <- NULL
  game$progress <- empty_progress()
  game$mode <- "levels"
  game$list_mode <- "levels"
  game$free_edges <- "wrap"
  game$level_index <- 1
  game$daily_date <- ""
  game$last_clear <- NULL
  game$confirm <- FALSE
  game$reset_done <- FALSE
  game$carry <- 0
  game$last <- NULL
  game$saving <- TRUE
  game$client <- list(touch = FALSE, canVibrate = FALSE, today = date_key(Sys.Date()), longDate = format(Sys.Date(), "%A %d %B"))

  screen <- reactiveVal("title")
  redraw <- reactiveVal(0)
  loop <- reactiveVal(0)
  bump <- function(rv) rv(isolate(rv()) + 1)

  input_kind <- function() if (isTRUE(game$client$touch)) "touch" else "keys"
  query <- isolate(parseQueryString(session$clientData$url_search %||% ""))
  fixed_layout <- identical(query$layout, "fixed")
  fixed_seed <- if (!is.null(query$seed) && grepl("^[0-9]+$", query$seed)) as.numeric(query$seed) else NULL

  say <- function(text) session$sendCustomMessage("say", text)

  save <- function() {
    game$progress <- clean_progress(game$progress)
    session$sendCustomMessage("save", progress_json(game$progress))
  }

  send_settings <- function() {
    s <- settings_of(game$progress)
    session$sendCustomMessage("settings", list(sound = isTRUE(s$sound), vibration = isTRUE(s$vibration)))
  }

  toggle_setting <- function(name) {
    s <- settings_of(game$progress)
    s[[name]] <- !isTRUE(s[[name]])
    game$progress$settings <- s
    save()
    send_settings()
    say(TEXT$say$setting(name, s[[name]]))
  }

  show <- function(name) {
    if (name != "help") {
      game$confirm <- FALSE
      game$reset_done <- FALSE
    }
    if (name != "game") game$last <- NULL
    screen(name)
    bump(redraw)
    session$sendCustomMessage("screen", list(name = name))
  }

  leave_run <- function() show(if (game$mode == "daily") "daily" else "levels")

  is_unlocked <- function(i) i == 1 || isTRUE(game$progress$levels[[LEVELS[[i - 1]]$id]]$cleared)

  next_level_index <- function() {
    for (i in seq_along(LEVELS)) {
      if (!is_unlocked(i)) return(max(1, i - 1))
      if (!isTRUE(game$progress$levels[[LEVELS[[i]]$id]]$cleared)) return(i)
    }
    length(LEVELS)
  }

  free_key <- function(level = LEVELS[[game$level_index]]) paste0(level$id, "-", game$free_edges)

  run_title <- function() {
    level <- LEVELS[[game$level_index]]
    switch(game$mode,
      daily = TEXT$run$daily(game$state$level$name),
      free = TEXT$run$free(level$name),
      practice = TEXT$run$practice(level$name),
      TEXT$run$level(level$number, level$name)
    )
  }

  # Playing

  start_run <- function(mode, i) {
    game$mode <- mode
    if (mode != "daily") game$list_mode <- mode
    seed <- fixed_seed %||% floor(stats::runif(1) * U32)
    if (mode == "daily") {
      game$daily_date <- game$client$today
      level <- daily_level(game$daily_date)
      seed <- fixed_seed %||% daily_seed(game$daily_date)
      i <- which(vapply(LEVELS, function(l) l$world == level$world, logical(1)))[1]
    } else if (mode == "free") {
      level <- free_play_level(LEVELS[[i]], game$free_edges)
    } else if (mode == "practice") {
      level <- practice_level(LEVELS[[i]])
    } else {
      level <- LEVELS[[i]]
    }
    if (!fixed_layout) level <- new_layout(level, layout_seed(seed))
    game$level_index <- i
    game$state <- create_game(level, seed)
    game$last_clear <- NULL
    game$carry <- 0
    game$last <- NULL
    show("game")
    s <- game$state
    session$sendCustomMessage("run", list(
      level = level,
      obstacles = as.list(s$obstacles),
      currents = as.list(s$currents),
      powerUps = !is.null(level$powerUps),
      hint = TEXT$hud$hint[[input_kind()]]
    ))
    say(paste(run_title(), level$challenge, TEXT$run$start[[input_kind()]]))
    send_frame(list())
    send_overlay()
  }

  frame_data <- function(s, events) {
    cell <- function(v) if (is.null(v)) NA else list(x = v[1], y = v[2])
    list(
      snake = lapply(seq_along(s$sx), function(i) list(x = s$sx[i], y = s$sy[i])),
      dir = s$dir,
      food = cell(s$food),
      powerUp = if (is.null(s$power_up)) NA else list(kind = s$power_up$kind, at = list(x = s$power_up$x, y = s$power_up$y), until = s$power_up$until),
      vehicles = as.list(s$vehicles),
      moves = s$moves,
      slowUntil = s$slow_until,
      passes = s$passes,
      status = s$status,
      crashAt = cell(s$crash_at),
      eaten = s$eaten,
      events = events
    )
  }

  hud_data <- function() {
    s <- game$state
    mode <- game$mode
    best <- 0
    if (mode == "levels") best <- game$progress$levels[[s$level$id]]$best %||% 0
    if (mode == "daily" && identical(game$progress$daily$date, game$daily_date)) best <- game$progress$daily$best
    if (mode == "free") best <- game$progress$free[[free_key()]] %||% 0
    power <- c(if (is_slow(s)) TEXT$hud$slow(s$slow_until - s$moves), if (s$passes > 0) TEXT$hud$passes(s$passes))
    list(
      level = run_title(),
      eaten = TEXT$hud$eaten(s$eaten, if (mode == "free") NULL else s$level$goal),
      score = as.character(s$score),
      best = as.character(max(best, if (mode == "free") s$eaten else s$score)),
      hideBest = mode == "practice",
      power = paste(power, collapse = ". "),
      pause = if (s$status == "paused") TEXT$buttons$resume else TEXT$buttons$pause,
      pauseDisabled = !s$status %in% c("running", "paused")
    )
  }

  send_frame <- function(events) {
    session$sendCustomMessage("frame", list(state = frame_data(game$state, events), hud = hud_data()))
  }

  overlay_html <- function() {
    s <- game$state
    level <- s$level
    mode <- game$mode
    r <- TEXT$run
    b <- TEXT$buttons
    has_next <- mode == "levels" && game$level_index < length(LEVELS)
    back <- act_button(b$back, "leave")
    stars_p <- function(n) h$p(class = "ss-stars ss-big", `aria-label` = r$stars(n), star_text(n))
    body <- NULL
    if (s$status == "ready" && !is.null(s$bump)) {
      body <- list(h$p(class = "ss-overlay-title", r$bump_title), h$p(paste(bump_text(s), r$bump_go)))
    } else if (s$status == "ready") {
      body <- list(
        h$p(class = "ss-overlay-title", run_title()),
        h$p(level$challenge),
        h$p(class = "ss-overlay-hint", r$start[[input_kind()]])
      )
    } else if (s$status == "paused") {
      body <- list(
        h$p(class = "ss-overlay-title", r$paused),
        h$div(class = "ss-actions", h$button(class = "ss-btn ss-primary", type = "button", `data-cmd` = "pause", b$resume), back)
      )
    } else if (s$status == "over") {
      best <- if (mode == "free") game$progress$free[[free_key()]] %||% 0 else 0
      tally <- if (mode == "free") r$free_tally(s$eaten, best) else r$tally(s$eaten, level$goal, s$score)
      body <- list(
        h$p(class = "ss-overlay-title", r$over), h$p(crash_text(s)), h$p(tally),
        h$div(class = "ss-actions", act_button(b$play_again, "again", class = "ss-btn ss-primary"), back)
      )
    } else if (s$status == "cleared" && mode == "practice") {
      body <- list(
        h$p(class = "ss-overlay-title", r$practice_done), h$p(r$practice_tally(level$goal, s$score)),
        h$div(class = "ss-actions", act_button(b$practice_again, "again", class = "ss-btn ss-primary"), back)
      )
    } else if (s$status == "cleared" && !is.null(game$last_clear)) {
      e <- game$last_clear
      note <- list()
      if (mode == "daily") {
        note <- list(h$p(r$daily_streak(current_streak(game$progress, game$daily_date))))
      } else {
        best <- game$progress$levels[[level$id]]$stars %||% e$stars
        if (best > e$stars) note <- c(note, list(h$p(r$best_stars(best))))
        if (!has_next) note <- c(note, list(h$p(r$all_cleared)))
      }
      body <- c(
        list(h$p(class = "ss-overlay-title", if (mode == "daily") r$daily_cleared else r$cleared), stars_p(e$stars), h$p(r$bonus(s$score, e$timeBonus))),
        note,
        list(h$div(
          class = "ss-actions",
          if (has_next) act_button(b$next_level, "next", class = "ss-btn ss-primary"),
          act_button(b$play_again, "again", class = if (has_next) "ss-btn" else "ss-btn ss-primary"),
          back
        ))
      )
    }
    if (is.null(body)) return("")
    as.character(h$div(class = "ss-panel", body))
  }

  send_overlay <- function() {
    s <- game$state
    session$sendCustomMessage("overlay", list(html = overlay_html(), running = s$status == "running", passive = s$status == "ready"))
  }

  on_event <- function(e) {
    s <- game$state
    level <- s$level
    mode <- game$mode
    if (e$type == "ate") say(TEXT$say$ate(s$eaten, s$score, if (mode == "free") NULL else level$goal))
    if (e$type == "bump") say(paste(bump_text(s), "Choose a new direction."))
    if (e$type == "speedup") say(TEXT$say$speedup)
    if (e$type == "powerAppeared") say(TEXT$say$power_appeared(TEXT$power$name[[e$kind]]))
    if (e$type == "power") say(TEXT$power$text[[e$kind]])
    if (e$type == "passed") say(TEXT$say$passed)
    if (e$type == "crash") {
      if (mode == "levels") game$progress <- record_run(game$progress, level$id, s$score, 0, FALSE)
      if (mode == "daily") game$progress <- record_daily(game$progress, game$daily_date, s$score, FALSE)
      if (mode == "free") game$progress <- record_free(game$progress, free_key(), s$eaten)
      save()
      say(paste(crash_text(s), paste0("Score ", s$score, ".")))
    }
    if (e$type == "cleared") {
      game$last_clear <- e
      if (mode == "levels") game$progress <- record_run(game$progress, level$id, e$score, e$stars, TRUE)
      if (mode == "daily") game$progress <- record_daily(game$progress, game$daily_date, e$score, TRUE)
      save()
      if (mode == "practice") say(paste0("Practice run complete. Score ", e$score, "."))
      else say(paste0(if (mode == "daily") "Daily challenge" else "Level", " cleared with ", e$stars, " of 3 stars. Score ", e$score, "."))
    }
  }

  # Applies a new state and its events, and tells the browser what changed.
  apply_state <- function(nxt, events = list()) {
    before <- game$state$status
    game$state <- nxt
    for (e in events) on_event(e)
    if (nxt$status != before) {
      send_overlay()
      if (nxt$status == "paused") say(TEXT$say$paused)
      if (nxt$status == "running" && before == "paused") say(TEXT$say$playing)
      if (nxt$status == "running") {
        game$carry <- 0
        game$last <- NULL
        bump(loop)
      }
    }
  }

  # The game loop. It runs only while the snake moves, and catches up on missed moves, a few at a time.
  observe({
    loop()
    s <- game$state
    if (is.null(s) || s$status != "running" || isolate(screen()) != "game") return()
    now <- as.numeric(Sys.time()) * 1000
    dt <- if (is.null(game$last)) 0 else min(now - game$last, 250)
    game$last <- now
    game$carry <- game$carry + dt
    events <- list()
    n <- 0
    while (n < 4 && game$carry >= move_ms(game$state) && game$state$status == "running") {
      game$carry <- game$carry - move_ms(game$state)
      r <- tick(game$state)
      apply_state(r$state, r$events)
      events <- c(events, r$events)
      n <- n + 1
    }
    if (n > 0) send_frame(events)
    if (game$state$status == "running") invalidateLater(max(5, ceiling(move_ms(game$state) - game$carry)))
  })

  # What the browser sends

  observeEvent(input$client, {
    c <- input$client
    for (name in c("touch", "canVibrate", "longDate")) if (!is.null(c[[name]])) game$client[[name]] <- c[[name]]
    if (is_date(c$today)) game$client$today <- c$today
    game$saving <- !identical(c$canSave, FALSE)
    game$progress <- parse_progress(c$saved)
    send_settings()
    bump(redraw)
  })

  # Another tab saved progress, so this one loads it, the way the web game does.
  observeEvent(input$saved, {
    game$progress <- parse_progress(input$saved$text)
    send_settings()
    bump(redraw)
  })

  observeEvent(input$cmd, {
    c <- input$cmd
    s <- game$state
    if (identical(c$type, "sound")) return(toggle_setting("sound"))
    if (identical(c$type, "vibration")) return(toggle_setting("vibration"))
    if (is.null(s) || screen() != "game") return()
    if (identical(c$type, "turn")) apply_state(turn(s, c$dir))
    else if (identical(c$type, "pause")) apply_state(toggle_pause(s))
    else if (identical(c$type, "hide")) apply_state(pause_game(s))
    else if (identical(c$type, "back")) {
      if (s$status == "running") apply_state(pause_game(s)) else leave_run()
      return()
    }
    session$sendCustomMessage("frame", list(state = frame_data(game$state, list()), hud = hud_data()))
  })

  observeEvent(input$act, {
    a <- input$act
    if (!is.null(a$today) && is_date(a$today)) game$client$today <- a$today
    if (!is.null(a$longDate)) game$client$longDate <- a$longDate
    arg <- a$arg
    switch(a$act,
      play = start_run("levels", next_level_index()),
      go = show(arg),
      levels = {
        game$list_mode <- "levels"
        show("levels")
      },
      tab = {
        game$list_mode <- arg
        bump(redraw)
      },
      edges = {
        game$free_edges <- arg
        bump(redraw)
      },
      level = start_run(game$list_mode, as.integer(arg)),
      daily = start_run("daily", 1),
      again = start_run(game$mode, game$level_index),
      `next` = start_run("levels", game$level_index + 1),
      leave = leave_run(),
      reset = {
        game$confirm <- TRUE
        game$reset_done <- FALSE
        bump(redraw)
      },
      cancel = {
        game$confirm <- FALSE
        bump(redraw)
      },
      confirm = {
        game$progress <- reset_progress(game$progress)
        save()
        game$confirm <- FALSE
        game$reset_done <- TRUE
        bump(redraw)
      }
    )
  })

  # The menu screens

  save_warning <- function() {
    if (game$saving) NULL else h$p(class = "ss-note ss-warn", role = "status", TEXT$cant_save)
  }

  title_screen <- function() {
    b <- TEXT$buttons
    h$div(
      class = "ss-title", `data-view` = "title",
      h$div(class = "ss-logo", h$img(src = "sankofa-logo.svg", width = 150, height = 150, alt = TEXT$logo_label)),
      h$h2(class = "ss-heading", TEXT$name),
      h$p(class = "ss-lead", TEXT$lead),
      h$div(
        class = "ss-actions",
        act_button(b$play, "play", class = "ss-btn ss-primary", `data-focus` = NA),
        act_button(b$daily, "go", "daily"),
        act_button(b$choose_level, "levels"),
        act_button(b$how_to_play, "go", "help")
      ),
      save_warning(),
      h$p(class = "ss-note", TEXT$sankofa_note)
    )
  }

  levels_screen <- function() {
    mode <- game$list_mode
    t <- TEXT$levels
    tab <- function(m) h$button(class = "ss-tab", type = "button", `data-act` = "tab", `data-arg` = m, `aria-pressed` = tolower(m == mode), t$heading[[m]])
    edge <- function(e, label) h$button(class = "ss-tab", type = "button", `data-act` = "edges", `data-arg` = e, `aria-pressed` = tolower(e == game$free_edges), label)
    first_open <- TRUE
    cards <- lapply(seq_along(LEVELS), function(i) {
      level <- LEVELS[[i]]
      p <- game$progress$levels[[level$id]]
      open <- mode == "practice" || is_unlocked(i)
      status <- if (!open) {
        h$span(t$locked(LEVELS[[i - 1]]$name))
      } else if (mode == "practice") {
        h$span(t$practice_status)
      } else if (mode == "free") {
        h$span(t$free_best(game$progress$free[[free_key(level)]] %||% 0))
      } else if (!is.null(p)) {
        list(h$span(class = "ss-stars", `aria-label` = TEXT$run$stars(p$stars), star_text(p$stars)), h$span(t$best(p$best)))
      } else {
        h$span(t$not_played)
      }
      focus <- if (open && first_open) NA else NULL
      if (open) first_open <<- FALSE
      h$li(h$button(
        class = paste0("ss-card ss-world-", level$world), type = "button", `data-act` = "level", `data-arg` = i,
        disabled = if (open) NULL else NA, `data-focus` = focus,
        h$span(class = "ss-card-top", t$card(level$number)),
        h$span(class = "ss-card-name", level$name),
        if (mode != "free") h$span(class = "ss-card-text", level$challenge),
        h$span(class = "ss-card-status", status)
      ))
    })
    h$div(
      class = "ss-levels", `data-view` = "levels",
      h$h2(class = "ss-heading", t$heading[[mode]]),
      h$div(class = "ss-tabs", role = "group", `aria-label` = t$tabs_label, tab("levels"), tab("free"), tab("practice")),
      if (mode == "free") h$div(class = "ss-tabs ss-tabs-small", role = "group", `aria-label` = t$edges_label, edge("wrap", t$wrap), edge("walls", t$walls)),
      h$p(class = "ss-note ss-intro", t$intro[[mode]]),
      h$ul(class = "ss-cards", cards),
      h$div(class = "ss-actions", act_button(TEXT$buttons$back, "go", "title"))
    )
  }

  daily_screen <- function() {
    t <- TEXT$daily
    today <- game$client$today
    level <- daily_level(today)
    d <- if (identical(game$progress$daily$date, today)) game$progress$daily else NULL
    longest <- game$progress$daily$bestStreak %||% 0
    h$div(
      class = "ss-daily", `data-view` = "daily",
      h$h2(class = "ss-heading", t$heading),
      h$p(class = "ss-lead", t$lead(game$client$longDate)),
      h$div(
        class = paste0("ss-card ss-daily-card ss-world-", level$world),
        h$span(class = "ss-card-top", t$world),
        h$span(class = "ss-card-name", level$name),
        h$span(class = "ss-card-text", t$goal(level$challenge, level$goal)),
        h$span(
          class = "ss-card-status",
          h$span(if (isTRUE(d$cleared)) t$cleared_today else t$not_cleared),
          h$span(t$todays_best(d$best %||% 0))
        )
      ),
      h$p(class = "ss-streak", t$streak_label, " ", h$strong(plural(current_streak(game$progress, today), "day", "days")), ". ", t$streak_rest(longest)),
      h$div(
        class = "ss-actions",
        act_button(TEXT$buttons$play_daily, "daily", class = "ss-btn ss-primary", `data-focus` = NA),
        act_button(TEXT$buttons$back, "go", "title")
      )
    )
  }

  help_screen <- function() {
    hp <- TEXT$help
    b <- TEXT$buttons
    kind <- input_kind()
    items <- c(hp$steer[[kind]], hp$rules, hp$pause[[kind]], hp$more, if (kind == "keys") hp$sound_key)
    s <- settings_of(game$progress)
    vib <- isTRUE(game$client$canVibrate)
    h$div(
      class = "ss-help", `data-view` = "help",
      h$h2(class = "ss-heading", tabindex = "-1", `data-focus` = if (game$confirm) NULL else NA, hp$heading),
      h$ul(class = "ss-list", lapply(items, h$li)),
      h$h3(class = "ss-subheading", hp$settings),
      h$div(
        class = "ss-tabs", role = "group", `aria-label` = hp$settings,
        h$button(class = "ss-tab", type = "button", `data-setting` = "sound", `aria-pressed` = tolower(isTRUE(s$sound)), b$sound),
        if (vib) h$button(class = "ss-tab", type = "button", `data-setting` = "vibration", `aria-pressed` = tolower(isTRUE(s$vibration)), b$vibration)
      ),
      h$p(class = "ss-note ss-intro", hp$gold_means_on, if (vib) paste0(" ", hp$vibration_note)),
      h$h3(class = "ss-subheading", hp$progress),
      h$p(class = "ss-note ss-intro", hp$progress_note),
      save_warning(),
      if (!game$confirm) h$div(class = "ss-actions", act_button(b$reset, "reset")),
      if (game$confirm) h$div(
        class = "ss-confirm", role = "group", `aria-labelledby` = "ss-confirm-text",
        h$p(id = "ss-confirm-text", hp$confirm),
        h$div(
          class = "ss-actions",
          act_button(b$confirm_reset, "confirm", class = "ss-btn ss-danger"),
          # Cancel takes the focus, so a stray Enter keeps the progress.
          act_button(b$cancel, "cancel", `data-focus` = NA)
        )
      ),
      h$p(class = "ss-note ss-done", role = "status", if (game$reset_done) hp$reset_done),
      h$div(class = "ss-actions", act_button(b$back, "go", "title"))
    )
  }

  output$screen <- renderUI({
    redraw()
    name <- screen()
    switch(name,
      title = title_screen(),
      levels = levels_screen(),
      daily = daily_screen(),
      help = help_screen(),
      NULL
    )
  })

  # The menu sits in a hidden element while a run is on, and Shiny would otherwise pause it there.
  outputOptions(output, "screen", suspendWhenHidden = FALSE)

  session$onFlushed(function() session$sendCustomMessage("screen", list(name = isolate(screen()))), once = TRUE)
}

shinyApp(ui, server)
