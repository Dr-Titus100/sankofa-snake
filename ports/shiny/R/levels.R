# The levels, read from the data files in the levels/ folder at the top of the repo.
# The web game reads the same files, so a change to a level shows up in every version.
# A level stays a plain list, shaped exactly like its JSON file.

CURRENT <- c("<" = "left", ">" = "right", "^" = "up", "v" = "down")

# The levels/ folder: SANKOFA_LEVELS if it is set, or the nearest levels/ folder above the app.
levels_dir <- function(from = getwd()) {
  env <- Sys.getenv("SANKOFA_LEVELS")
  if (nzchar(env)) return(env)
  dir <- normalizePath(from, mustWork = FALSE)
  repeat {
    if (file.exists(file.path(dir, "levels", "01-farm.json"))) return(file.path(dir, "levels"))
    parent <- dirname(dir)
    if (parent == dir) break
    dir <- parent
  }
  stop("Can't find the levels folder. Set SANKOFA_LEVELS to its path.")
}

load_levels <- function(dir = levels_dir()) {
  files <- sort(list.files(dir, pattern = "^[0-9]+-.*\\.json$", full.names = TRUE))
  levels <- lapply(files, function(f) jsonlite::read_json(f, simplifyVector = FALSE))
  levels[order(vapply(levels, function(l) l$number, numeric(1)))]
}

key <- function(x, y) if (length(x)) paste0(x, ",", y) else character(0)

map_cells <- function(level) {
  rows <- level$map
  if (is.null(rows) || !length(rows)) return(list(x = integer(0), y = integer(0), ch = character(0)))
  chars <- strsplit(unlist(rows), "")
  ys <- rep(seq_along(chars) - 1L, lengths(chars))
  xs <- unlist(lapply(chars, function(r) seq_along(r) - 1L))
  list(x = xs, y = ys, ch = unlist(chars))
}

# The obstacle cells of a level as "x,y" keys, in reading order.
obstacle_keys <- function(level) {
  m <- map_cells(level)
  hit <- m$ch == "#"
  key(m$x[hit], m$y[hit])
}

# The current cells of a level, as a named vector: names are "x,y" keys, values the way each pushes.
current_keys <- function(level) {
  m <- map_cells(level)
  hit <- m$ch %in% names(CURRENT)
  stats::setNames(unname(CURRENT[m$ch[hit]]), key(m$x[hit], m$y[hit]))
}

BACK <- list(up = c(0, 1), down = c(0, -1), left = c(1, 0), right = c(-1, 0))

is_whole <- function(v) is.numeric(v) && length(v) == 1 && !is.na(v) && v == floor(v)

# Checks a level for mistakes. Returns the problems, empty when the level is fine.
validate_level <- function(level) {
  problems <- character(0)
  add <- function(p) problems <<- c(problems, p)
  width <- level$width
  height <- level$height
  start <- level$start
  speed <- level$speed
  if (!is_whole(width) || !is_whole(height) || width < 8 || height < 8) {
    add("the board must be whole numbers of cells, at least 8 by 8")
  }
  if (length(level$map)) {
    if (length(level$map) != height) add(sprintf("the map has %d rows, expected %d", length(level$map), height))
    for (y in seq_along(level$map)) {
      row <- level$map[[y]]
      if (nchar(row) != width) add(sprintf("map row %d has the wrong number of cells", y - 1))
      if (grepl("[^.#<>^v]", row)) add(sprintf("map row %d uses a character that isn't allowed", y - 1))
    }
  }
  if (speed$start <= 0 || speed$max < speed$start || speed$step < 0 || speed$every < 1) add("the speed settings don't make sense")
  if (level$goal < 1) add("the goal must be at least one cowrie")
  if (level$stars[[1]] > level$stars[[2]]) add("the three-star score must be at least the two-star score")

  obstacles <- obstacle_keys(level)
  currents <- names(current_keys(level))
  lanes <- character(0)
  for (i in seq_along(level$vehicles)) {
    v <- level$vehicles[[i]]
    across <- if (v$axis == "row") height else width
    along <- if (v$axis == "row") width else height
    if (!is_whole(v$lane) || v$lane < 0 || v$lane >= across) add(sprintf("vehicle %d drives on a lane off the board", i - 1))
    if (v$length < 1 || v$length >= along) add(sprintf("vehicle %d must be shorter than its lane", i - 1))
    if (!is_whole(v$every) || v$every < 1) add(sprintf("vehicle %d must move every 1 or more snake moves", i - 1))
    if (v$start < 0 || v$start >= along) add(sprintf("vehicle %d starts off the board", i - 1))
    p <- seq_len(along) - 1
    cells <- if (v$axis == "row") key(p, v$lane) else key(v$lane, p)
    lanes <- c(lanes, cells)
    if (any(cells %in% obstacles)) add(sprintf("vehicle %d drives through an obstacle", i - 1))
    if (any(cells %in% currents)) add(sprintf("vehicle %d drives through a current", i - 1))
  }

  pu <- level$powerUps
  if (!is.null(pu)) {
    kinds <- unlist(pu$kinds)
    if (!length(kinds) || !all(kinds %in% c("slow", "shrink", "pass"))) add("power-up kinds must be some of slow, shrink and pass")
    if (!is_whole(pu$every) || pu$every < 1) add("power-ups must appear every 1 or more cowries")
    if (!is_whole(pu$lasts) || pu$lasts < 1) add("power-ups must last 1 or more moves")
  }

  back <- BACK[[start$dir]]
  for (i in seq_len(start$length) - 1) {
    x <- start$x + back[1] * i
    y <- start$y + back[2] * i
    k <- key(x, y)
    if (x < 0 || y < 0 || x >= width || y >= height) add(sprintf("start cell %s is off the board", k))
    else if (k %in% obstacles) add(sprintf("start cell %s is on an obstacle", k))
    else if (k %in% lanes) add(sprintf("start cell %s is on a vehicle's lane", k))
    else if (k %in% currents) add(sprintf("start cell %s is on a current", k))
  }
  problems
}

LEVELS <- load_levels()
