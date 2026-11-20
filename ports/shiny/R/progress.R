# Best scores, stars, cleared levels, the daily streak and free play bests.
#
# The Shiny app keeps progress in the player's browser, in the same format as the web game, so it
# stays on their device and never on the server. The browser sends the saved text when the app
# opens, and every value is checked here before the game uses it, the same way storage.ts does.

SAVE_VERSION <- 2
LIMITS <- list(score = 1e6, cowries = 1e4, streak = 1e5)

is_count <- function(v, top) is.numeric(v) && length(v) == 1 && !is.na(v) && v == floor(v) && v >= 0 && v <= top

is_date <- function(v) {
  if (!is.character(v) || length(v) != 1 || !grepl("^\\d{4}-\\d{2}-\\d{2}$", v)) return(FALSE)
  d <- tryCatch(as.Date(v, format = "%Y-%m-%d"), error = function(e) NA)
  !is.na(d) && format(d, "%Y-%m-%d") == v
}

empty_progress <- function() list(levels = list())

# Keeps the good values of a saved object and drops the rest. Never fails.
clean_progress <- function(raw) {
  out <- empty_progress()
  if (!is.list(raw) || is.null(names(raw))) return(out)
  ids <- vapply(LEVELS, function(l) l$id, character(1))
  if (is.list(raw$levels) && length(raw$levels) && !is.null(names(raw$levels))) {
    for (id in names(raw$levels)) {
      v <- raw$levels[[id]]
      if (!id %in% ids || !is.list(v)) next
      out$levels[[id]] <- list(
        best = if (is_count(v$best, LIMITS$score)) v$best else 0,
        stars = if (is_count(v$stars, 3)) v$stars else 0,
        cleared = isTRUE(v$cleared)
      )
    }
  }
  d <- raw$daily
  if (is.list(d) && is_date(d$date)) {
    streak <- if (is_count(d$streak, LIMITS$streak)) d$streak else 0
    last <- if (is_date(d$lastCleared)) d$lastCleared else NULL
    best_streak <- if (is_count(d$bestStreak, LIMITS$streak)) d$bestStreak else 0
    out$daily <- list(
      date = d$date,
      best = if (is_count(d$best, LIMITS$score)) d$best else 0,
      cleared = isTRUE(d$cleared),
      streak = if (is.null(last)) 0 else streak,
      bestStreak = max(best_streak, if (is.null(last)) 0 else streak)
    )
    if (!is.null(last)) out$daily$lastCleared <- last
  }
  if (is.list(raw$free) && length(raw$free) && !is.null(names(raw$free))) {
    free <- list()
    for (k in names(raw$free)) {
      m <- regmatches(k, regexec("^([a-z]+)-(wrap|walls)$", k))[[1]]
      if (length(m) && m[2] %in% ids && is_count(raw$free[[k]], LIMITS$cowries)) free[[k]] <- raw$free[[k]]
    }
    if (length(free)) out$free <- free
  }
  if (is.list(raw$settings)) {
    out$settings <- list(sound = !identical(raw$settings$sound, FALSE), vibration = !identical(raw$settings$vibration, FALSE))
  }
  out
}

# Reads the text the browser saved. Damaged text gives empty progress.
parse_progress <- function(text) {
  if (is.null(text) || !is.character(text) || !nzchar(text)) return(empty_progress())
  raw <- tryCatch(jsonlite::fromJSON(text, simplifyVector = FALSE), error = function(e) NULL)
  clean_progress(raw)
}

# The progress as the JSON text the web game saves, with "levels" always an object.
progress_json <- function(progress) {
  obj <- function(x) if (length(x)) x else structure(list(), names = character(0))
  out <- c(list(version = SAVE_VERSION), progress)
  out$levels <- obj(progress$levels)
  as.character(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null"))
}

settings_of <- function(progress) {
  s <- list(sound = TRUE, vibration = TRUE)
  if (!is.null(progress$settings)) s[names(progress$settings)] <- progress$settings
  s
}

# Deletes scores, stars, cleared levels, the daily streak and free play bests. Keeps the switches.
reset_progress <- function(progress) {
  out <- empty_progress()
  if (!is.null(progress$settings)) out$settings <- progress$settings
  out
}

record_run <- function(progress, id, score, stars, cleared) {
  old <- progress$levels[[id]]
  if (is.null(old)) old <- list(best = 0, stars = 0, cleared = FALSE)
  progress$levels[[id]] <- list(best = max(old$best, score), stars = max(old$stars, stars), cleared = old$cleared || cleared)
  progress
}

record_daily <- function(progress, date, score, cleared) {
  old <- progress$daily
  same_day <- !is.null(old) && old$date == date
  daily <- list(
    date = date,
    best = max(if (same_day) old$best else 0, score),
    cleared = (same_day && old$cleared) || cleared,
    streak = if (is.null(old)) 0 else old$streak,
    bestStreak = if (is.null(old)) 0 else old$bestStreak
  )
  if (!is.null(old$lastCleared)) daily$lastCleared <- old$lastCleared
  if (cleared) {
    daily$streak <- next_streak(old$lastCleared, if (is.null(old)) 0 else old$streak, date)
    daily$lastCleared <- date
    daily$bestStreak <- max(daily$bestStreak, daily$streak)
  }
  progress$daily <- daily
  progress
}

# The streak to show today. It drops to 0 once a whole day passes without a clear.
current_streak <- function(progress, today) {
  d <- progress$daily
  if (is.null(d$lastCleared)) return(0)
  if (d$lastCleared %in% c(today, day_before(today))) d$streak else 0
}

record_free <- function(progress, k, eaten) {
  if (is.null(progress$free)) progress$free <- list()
  old <- progress$free[[k]]
  progress$free[[k]] <- max(if (is.null(old)) 0 else old, eaten)
  progress
}
