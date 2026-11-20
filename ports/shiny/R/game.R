# The rules of Sankofa Snake, ported line by line from packages/core/src/game.ts.
#
# Nothing here draws anything or reads the keyboard. Every function takes a game state and returns
# a new one. R copies a list when it changes, so the old state is never changed either. The tests
# in tests/testthat replay runs recorded from the TypeScript rules and check every move.
#
# The snake is kept as two vectors, sx and sy, head first. Obstacles are "x,y" keys.

STEP <- list(up = c(0, -1), down = c(0, 1), left = c(-1, 0), right = c(1, 0))
OPPOSITE <- c(up = "down", down = "up", left = "right", right = "left")

MAX_QUEUED_TURNS <- 2
SLOW_MOVES <- 40
SLOW_SHARE <- 0.6
MIN_SPEED <- 3
SHRINK_CELLS <- 4
MIN_LENGTH <- 3

# Rounds the way JavaScript's Math.round does: halves go up.
js_round <- function(x) floor(x + 0.5)

wrap_xy <- function(x, y, level) c(x %% level$width, y %% level$height)

# Starts a level. The snake waits until the player picks a direction.
create_game <- function(level, seed) {
  st <- level$start
  back <- STEP[[OPPOSITE[[st$dir]]]]
  i <- seq_len(st$length) - 1
  state <- list(
    level = level,
    sx = (st$x + back[1] * i) %% level$width,
    sy = (st$y + back[2] * i) %% level$height,
    dir = st$dir,
    last_step = st$dir,
    queue = character(0),
    food = NULL,
    obstacles = obstacle_keys(level),
    currents = current_keys(level),
    eaten = 0,
    score = 0,
    speed = level$speed$start,
    speed_level = 1,
    grow = 0,
    elapsed_ms = 0,
    moves = 0,
    vehicles = vapply(level$vehicles, function(v) as.numeric(v$start), numeric(1)),
    power_up = NULL,
    slow_until = 0,
    passes = 0,
    status = "ready",
    rng = u32(seed),
    crash = NULL,
    crash_vehicle = NULL,
    bump = NULL,
    crash_pushed = FALSE,
    crash_at = NULL
  )
  place_food(state)
}

# Records a turn. A turn back the way the snake came is ignored. The first accepted one starts the game.
turn <- function(state, dir) {
  if (!state$status %in% c("ready", "running")) return(state)
  q <- state$queue
  last <- if (length(q)) q[length(q)] else state$dir
  if (dir == OPPOSITE[[last]]) return(state)
  if (!length(q) && dir == OPPOSITE[[state$last_step]]) return(state)
  state$status <- "running"
  if (dir == last || length(q) >= MAX_QUEUED_TURNS) return(state)
  state$queue <- c(q, dir)
  state
}

toggle_pause <- function(state) {
  if (state$status == "running") state$status <- "paused"
  else if (state$status == "paused") state$status <- "running"
  state
}

pause_game <- function(state) {
  if (state$status == "running") state$status <- "paused"
  state
}

is_slow <- function(state) state$moves < state$slow_until

speed_now <- function(state) {
  if (is_slow(state)) max(MIN_SPEED, js_round(state$speed * SLOW_SHARE)) else state$speed
}

move_ms <- function(state) 1000 / speed_now(state)

# Moves the snake one cell. When the head crosses a current, it is carried one more cell sideways.
# Returns list(state, events).
tick <- function(state) {
  if (state$status != "running") return(list(state = state, events = list()))
  events <- list()
  level <- state$level

  q <- state$queue
  while (length(q) && (q[1] == OPPOSITE[[state$last_step]] || q[1] == OPPOSITE[[state$dir]])) q <- q[-1]
  dir <- if (length(q)) q[1] else state$dir
  if (length(q)) q <- q[-1]
  moves <- state$moves + 1
  vehicles <- move_vehicles(level, state$vehicles, moves, state$sx, state$sy)
  pu <- state$power_up
  if (!is.null(pu) && moves >= pu$until) {
    pu <- NULL
    events[[length(events) + 1]] <- list(type = "powerGone")
  }
  elapsed <- state$elapsed_ms + move_ms(state)
  moved <- state
  moved$moves <- moves
  moved$vehicles <- vehicles
  moved["power_up"] <- list(pu)
  moved$queue <- q
  moved$elapsed_ms <- elapsed

  r <- move_once(moved, dir, dir, events, FALSE)
  nxt <- r$state
  events <- r$events
  push <- NULL
  if (nxt$status == "running") {
    k <- key(nxt$sx[1], nxt$sy[1])
    if (k %in% names(nxt$currents)) push <- nxt$currents[[k]]
  }
  if (!is.null(push) && push != dir && push != OPPOSITE[[dir]]) {
    events[[length(events) + 1]] <- list(type = "current", dir = push)
    r <- move_once(nxt, push, dir, events, TRUE)
    nxt <- r$state
    events <- r$events
  }
  list(state = nxt, events = events)
}

move_once <- function(state, step, heading, events, pushed) {
  level <- state$level
  nx <- state$sx[1] + STEP[[step]][1]
  ny <- state$sy[1] + STEP[[step]][2]
  fail <- function(cause, vehicle = NULL) crash(state, cause, c(nx, ny), heading, events, pushed, vehicle)

  outside <- nx < 0 || ny < 0 || nx >= level$width || ny >= level$height
  if (outside && level$edges == "walls") return(fail("wall"))
  w <- wrap_xy(nx, ny, level)
  nx <- w[1]
  ny <- w[2]

  if (key(nx, ny) %in% state$obstacles) return(fail("obstacle"))
  vehicle <- vehicle_at(level, state$vehicles, nx, ny)
  if (!is.null(vehicle)) return(fail("vehicle", vehicle))

  eating <- !is.null(state$food) && state$food[1] == nx && state$food[2] == ny
  tail_moves <- !eating && state$grow == 0
  n <- length(state$sx)
  bx <- if (tail_moves) state$sx[-n] else state$sx
  by <- if (tail_moves) state$sy[-n] else state$sy
  passes <- state$passes
  pu <- state$power_up
  if (any(bx == nx & by == ny)) {
    if (passes == 0) return(fail("self"))
    passes <- passes - 1
    events[[length(events) + 1]] <- list(type = "passed")
  }

  sx <- c(nx, bx)
  sy <- c(ny, by)
  grow <- state$grow
  eaten <- state$eaten
  score <- state$score
  speed <- state$speed
  speed_level <- state$speed_level
  slow_until <- state$slow_until
  if (!eating && grow > 0) grow <- grow - 1

  if (!is.null(pu) && pu$x == nx && pu$y == ny) {
    if (pu$kind == "slow") slow_until <- state$moves + SLOW_MOVES
    if (pu$kind == "pass") passes <- passes + 1
    if (pu$kind == "shrink") {
      keep <- max(MIN_LENGTH, length(sx) - SHRINK_CELLS)
      sx <- sx[seq_len(min(keep, length(sx)))]
      sy <- sy[seq_len(min(keep, length(sy)))]
      grow <- 0
    }
    events[[length(events) + 1]] <- list(type = "power", kind = pu$kind)
    pu <- NULL
  }

  nxt <- state
  nxt$sx <- sx
  nxt$sy <- sy
  nxt$dir <- heading
  nxt$last_step <- step
  nxt$grow <- grow
  nxt["power_up"] <- list(pu)
  nxt$slow_until <- slow_until
  nxt$passes <- passes
  nxt["bump"] <- list(NULL)
  if (!eating) return(list(state = nxt, events = events))

  eaten <- eaten + 1
  points <- 10 * speed_level
  score <- score + points
  events[[length(events) + 1]] <- list(type = "ate", x = nx, y = ny, points = points)

  if (eaten >= level$goal) {
    bonus <- max(0, js_round(level$parSeconds - state$elapsed_ms / 1000)) * 5
    score <- score + bonus
    stars <- stars_for(level, score)
    events[[length(events) + 1]] <- list(type = "cleared", score = score, stars = stars, timeBonus = bonus)
    nxt$eaten <- eaten
    nxt$score <- score
    nxt["food"] <- list(NULL)
    nxt$status <- "cleared"
    return(list(state = nxt, events = events))
  }

  s <- level$speed
  if (s$step > 0 && eaten %% s$every == 0 && speed < s$max) {
    speed <- min(s$max, speed + s$step)
    speed_level <- speed_level + 1
    events[[length(events) + 1]] <- list(type = "speedup", speed = speed)
  }
  nxt$eaten <- eaten
  nxt$score <- score
  nxt$speed <- speed
  nxt$speed_level <- speed_level
  nxt <- place_food(nxt)
  rule <- level$powerUps
  if (!is.null(rule) && length(rule$kinds) && eaten %% rule$every == 0 && is.null(nxt$power_up)) {
    nxt <- place_power_up(nxt)
    if (!is.null(nxt$power_up)) {
      events[[length(events) + 1]] <- list(type = "powerAppeared", kind = nxt$power_up$kind, x = nxt$power_up$x, y = nxt$power_up$y)
    }
  }
  list(state = nxt, events = events)
}

# One star for clearing the level, and one more for each score threshold reached.
stars_for <- function(level, score) {
  1 + (score >= level$stars[[1]]) + (score >= level$stars[[2]])
}

crash <- function(state, cause, at, dir, events, pushed, vehicle = NULL) {
  if (isTRUE(state$level$practice)) {
    events[[length(events) + 1]] <- list(type = "bump", cause = cause)
    state$dir <- state$last_step
    state$queue <- character(0)
    state$status <- "ready"
    state$bump <- cause
    return(list(state = state, events = events))
  }
  events[[length(events) + 1]] <- list(type = "crash", cause = cause)
  state$dir <- dir
  state$queue <- character(0)
  state$status <- "over"
  state$crash <- cause
  state$crash_at <- at
  state["crash_vehicle"] <- list(vehicle)
  state$crash_pushed <- isTRUE(pushed)
  list(state = state, events = events)
}

# The cells a vehicle covers when its front is at the given place along its lane, front first.
vehicle_cells <- function(v, level, front) {
  lane_length <- if (v$axis == "row") level$width else level$height
  along <- (front - v$dir * (seq_len(v$length) - 1)) %% lane_length
  if (v$axis == "row") list(x = along, y = rep(v$lane, v$length)) else list(x = rep(v$lane, v$length), y = along)
}

vehicle_keys <- function(level, fronts) {
  out <- character(0)
  for (i in seq_along(level$vehicles)) {
    c <- vehicle_cells(level$vehicles[[i]], level, fronts[i])
    out <- c(out, key(c$x, c$y))
  }
  out
}

vehicle_at <- function(level, fronts, x, y) {
  for (i in seq_along(level$vehicles)) {
    c <- vehicle_cells(level$vehicles[[i]], level, fronts[i])
    if (any(c$x == x & c$y == y)) return(level$vehicles[[i]]$kind)
  }
  NULL
}

# Moves each vehicle one cell when its turn comes. It waits while the snake or another vehicle is in the way.
move_vehicles <- function(level, fronts, moves, sx, sy) {
  vs <- level$vehicles
  if (!length(vs)) return(fronts)
  nxt <- fronts
  snake <- key(sx, sy)
  for (i in seq_along(vs)) {
    v <- vs[[i]]
    if (moves %% v$every != 0) next
    ahead <- vehicle_cells(v, level, nxt[i] + v$dir)
    k <- key(ahead$x[1], ahead$y[1])
    blocked <- k %in% snake
    if (!blocked) {
      for (j in seq_along(vs)) {
        if (j == i) next
        o <- vehicle_cells(vs[[j]], level, nxt[j])
        if (k %in% key(o$x, o$y)) {
          blocked <- TRUE
          break
        }
      }
    }
    if (!blocked) {
      lane_length <- if (v$axis == "row") level$width else level$height
      nxt[i] <- (nxt[i] + v$dir) %% lane_length
    }
  }
  nxt
}

open_cells <- function(state, food, power) {
  level <- state$level
  taken <- c(key(state$sx, state$sy), vehicle_keys(level, state$vehicles), state$obstacles)
  if (!is.null(food)) taken <- c(taken, key(food[1], food[2]))
  if (!is.null(power)) taken <- c(taken, key(power$x, power$y))
  xs <- rep(seq_len(level$width) - 1, times = level$height)
  ys <- rep(seq_len(level$height) - 1, each = level$width)
  free <- !(key(xs, ys) %in% taken)
  list(x = xs[free], y = ys[free])
}

# Puts a cowrie on a random open cell.
place_food <- function(state) {
  cells <- open_cells(state, NULL, state$power_up)
  if (!length(cells$x)) {
    state["food"] <- list(NULL)
    return(state)
  }
  r <- next_random(state$rng)
  i <- floor(r$value * length(cells$x)) + 1
  state$food <- c(cells$x[i], cells$y[i])
  state$rng <- r$state
  state
}

# Puts a power-up of a random kind from the level's list on a random open cell.
place_power_up <- function(state, kind = NULL) {
  rule <- state$level$powerUps
  kinds <- unlist(rule$kinds)
  if (is.null(rule) || !length(kinds)) return(state)
  rng <- state$rng
  if (is.null(kind)) {
    r <- next_random(rng)
    rng <- r$state
    kind <- kinds[floor(r$value * length(kinds)) + 1]
  }
  cells <- open_cells(state, state$food, NULL)
  if (!length(cells$x)) {
    state$rng <- rng
    return(state)
  }
  r <- next_random(rng)
  i <- floor(r$value * length(cells$x)) + 1
  state$power_up <- list(kind = kind, x = cells$x[i], y = cells$y[i], until = state$moves + rule$lasts)
  state$rng <- r$state
  state
}
