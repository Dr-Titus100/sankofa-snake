# The other ways to play: the daily challenge, free play and practice. Ported from modes.ts.

# A date as YYYY-MM-DD. Pass the player's own local date, so the challenge changes at their midnight.
date_key <- function(d) format(as.Date(d), "%Y-%m-%d")

day_before <- function(date) date_key(as.Date(date) - 1)

PACES <- list(
  steady = list(start = 6, step = 1, every = 5, max = 9),
  brisk = list(start = 7, step = 1, every = 5, max = 11),
  fast = list(start = 8, step = 1, every = 4, max = 12)
)

# The daily challenge for a date: a world, its edges, a pace and maybe power-ups, the same for everyone.
daily_level <- function(date) {
  r <- rand_stream(seed_from(paste0("sankofa-daily:", date)))
  base <- LEVELS[[floor(r() * length(LEVELS)) + 1]]
  edges <- if (r() < 0.5) "walls" else "wrap"
  pace <- names(PACES)[floor(r() * length(PACES)) + 1]
  power_ups <- base$powerUps
  if (is.null(power_ups) && r() < 0.5) power_ups <- list(kinds = list("slow", "shrink", "pass"), every = 3, lasts = 60)
  parts <- c(if (edges == "walls") "solid walls" else "wrap-around edges", paste0("a ", pace, " pace"))
  if (!is.null(power_ups)) parts <- c(parts, "power-ups")
  if (length(base$vehicles)) parts <- c(parts, "road traffic")
  last <- parts[length(parts)]
  parts <- parts[-length(parts)]
  level <- base
  level$id <- paste0("daily-", date)
  level$challenge <- paste0("The ", base$name, ", with ", paste(parts, collapse = ", "), " and ", last, ".")
  level$edges <- edges
  level$speed <- PACES[[pace]]
  level["powerUps"] <- list(power_ups)
  if (is.null(power_ups)) level$powerUps <- NULL
  level
}

# The seed for the daily challenge's cowries, the same for every player on that date.
daily_seed <- function(date) seed_from(paste0("sankofa-daily-seed:", date))

next_streak <- function(last, streak, today) {
  if (!is.null(last) && last == today) return(streak)
  if (!is.null(last) && last == day_before(today)) return(streak + 1)
  1
}

# No cowrie count ends a free play run.
ENDLESS <- 100000

free_play_level <- function(base, edges) {
  level <- base
  level$id <- paste0("free-", base$id, "-", edges)
  level$challenge <- "Collect as many cowries as you can. The run goes on until the snake crashes."
  level$edges <- edges
  level$goal <- ENDLESS
  level
}

practice_level <- function(base) {
  start <- max(3, base$speed$start - 3)
  level <- base
  level$id <- paste0("practice-", base$id)
  level$speed <- list(start = start, step = 0, every = base$speed$every, max = start)
  level$practice <- TRUE
  level
}
