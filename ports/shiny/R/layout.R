# New layouts for every run, ported from packages/core/src/layout.ts.
#
# A level file is a template: its map says which obstacle pieces, currents and roads the level
# has, and new_layout() places them somewhere new. The Maze builds a new maze instead. The same
# seed gives the same layout here as in the web game, so the daily challenge looks the same.

TRIES <- 80
LANE_GAP <- 4
SIDES <- list(c(1, 0), c(-1, 0), c(0, 1), c(0, -1))

# The seed for a run's layout. It differs from the seed for the cowries.
layout_seed <- function(seed) seed_from(paste0("sankofa-layout:", num(u32(seed))))

shuffle_list <- function(r, items) {
  n <- length(items)
  if (n > 1) {
    for (i in seq(n - 1, 1)) {
      j <- below(r, i + 1)
      tmp <- items[[i + 1]]
      items[[i + 1]] <- items[[j + 1]]
      items[[j + 1]] <- tmp
    }
  }
  items
}

split_key <- function(k) as.numeric(strsplit(k, ",", fixed = TRUE)[[1]])

# The pieces of obstacle in a map: groups of "#" cells that touch side by side.
obstacle_pieces <- function(level) {
  left <- obstacle_keys(level)
  all <- left
  pieces <- list()
  for (start in all) {
    if (!start %in% left) next
    found <- list()
    stack <- start
    left <- left[left != start]
    while (length(stack)) {
      k <- stack[length(stack)]
      stack <- stack[-length(stack)]
      xy <- split_key(k)
      found[[length(found) + 1]] <- xy
      for (d in SIDES) {
        nk <- key(xy[1] + d[1], xy[2] + d[2])
        if (nk %in% left) {
          left <- left[left != nk]
          stack <- c(stack, nk)
        }
      }
    }
    xs <- vapply(found, `[`, numeric(1), 1)
    ys <- vapply(found, `[`, numeric(1), 2)
    cx <- xs - min(xs)
    cy <- ys - min(ys)
    pieces[[length(pieces) + 1]] <- list(x = cx, y = cy, width = max(cx) + 1, height = max(cy) + 1)
  }
  pieces
}

# The currents in a map, as straight runs: "<" and ">" along a row, "^" and "v" down a column.
current_runs <- function(level) {
  rows <- unlist(level$map)
  if (!length(rows)) return(list())
  grid <- strsplit(rows, "")
  at <- function(x, y) {
    if (y < 1 || y > length(grid) || x < 1 || x > length(grid[[y]])) return("")
    grid[[y]][x]
  }
  runs <- list()
  for (y in seq_along(grid)) {
    for (x in seq_along(grid[[y]])) {
      ch <- grid[[y]][x]
      if (ch %in% c("<", ">") && at(x - 1, y) != ch) {
        n <- 0
        while (at(x + n, y) == ch) n <- n + 1
        runs[[length(runs) + 1]] <- list(axis = "row", length = n)
      }
      if (ch %in% c("^", "v") && at(x, y - 1) != ch) {
        n <- 0
        while (at(x, y + n) == ch) n <- n + 1
        runs[[length(runs) + 1]] <- list(axis = "column", length = n)
      }
    }
  }
  runs
}

# The snake's starting cells and the four cells ahead of its head, which every layout keeps clear.
start_zone <- function(level) {
  s <- level$start
  d <- STEP[[s$dir]]
  i <- seq(-(s$length - 1), 4)
  xs <- s$x + d[1] * i
  ys <- s$y + d[2] * i
  ok <- xs >= 0 & ys >= 0 & xs < level$width & ys < level$height
  list(x = xs[ok], y = ys[ok])
}

# Every open cell can be reached from the snake's head without wrapping around an edge.
all_open_connected <- function(level) {
  blocked <- obstacle_keys(level)
  w <- level$width
  h <- level$height
  open <- w * h - length(blocked)
  first <- key(level$start$x, level$start$y)
  if (first %in% blocked) return(FALSE)
  grid <- matrix(FALSE, w, h)
  if (length(blocked)) {
    b <- do.call(rbind, lapply(blocked, split_key))
    grid[cbind(b[, 1] + 1, b[, 2] + 1)] <- TRUE
  }
  seen <- matrix(FALSE, w, h)
  seen[level$start$x + 1, level$start$y + 1] <- TRUE
  stack <- list(c(level$start$x, level$start$y))
  count <- 1
  while (length(stack)) {
    p <- stack[[length(stack)]]
    stack[[length(stack)]] <- NULL
    for (d in SIDES) {
      nx <- p[1] + d[1]
      ny <- p[2] + d[2]
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) next
      if (seen[nx + 1, ny + 1] || grid[nx + 1, ny + 1]) next
      seen[nx + 1, ny + 1] <- TRUE
      count <- count + 1
      stack[[length(stack) + 1]] <- c(nx, ny)
    }
  }
  count == open
}

# A new layout for a level. If no fair layout turns up after many tries, the level keeps its own map.
new_layout <- function(level, seed) {
  mode <- if (is.null(level$layout)) "shuffle" else level$layout
  if (mode == "fixed") return(level)
  if (mode == "maze") return(new_maze(level, rand_stream(seed)))
  if (!length(level$map) && !length(level$vehicles)) return(level)
  r <- rand_stream(seed)
  pieces <- obstacle_pieces(level)
  runs <- current_runs(level)
  for (i in seq_len(TRIES)) {
    made <- try_shuffle(level, r, pieces, runs)
    if (!is.null(made) && all_open_connected(made) && !length(validate_level(made))) return(made)
  }
  level
}

try_shuffle <- function(level, r, pieces, runs) {
  w <- level$width
  h <- level$height
  grid <- matrix(".", h, w)
  inside <- function(x, y) x >= 0 && y >= 0 && x < w && y < h
  z <- start_zone(level)
  reserved <- character(0)
  for (i in seq_along(z$x)) {
    for (dy in -1:1) for (dx in -1:1) reserved <- c(reserved, key(z$x[i] + dx, z$y[i] + dy))
  }
  reserved <- unique(reserved)

  lanes <- place_lanes(level, r, reserved)
  if (is.null(lanes)) return(NULL)
  road <- character(0)
  for (lane in lanes) {
    p <- seq_len(if (lane$axis == "row") w else h) - 1
    road <- c(road, if (lane$axis == "row") key(p, lane$lane) else key(lane$lane, p))
  }
  vehicles <- place_vehicles(level, r, lanes)
  if (is.null(vehicles)) return(NULL)

  near_taken <- function(x, y) {
    for (dy in -1:1) for (dx in -1:1) {
      nx <- x + dx
      ny <- y + dy
      if (inside(nx, ny) && grid[ny + 1, nx + 1] != ".") return(TRUE)
    }
    FALSE
  }

  for (run in runs) {
    placed <- FALSE
    t <- 0
    while (t < 200 && !placed) {
      t <- t + 1
      flip <- r() < 0.5
      arrow <- if (run$axis == "row") (if (flip) "<" else ">") else (if (flip) "^" else "v")
      len <- min(run$length, if (run$axis == "row") w else h)
      x0 <- if (run$axis == "row") below(r, w - len + 1) else 1 + below(r, w - 2)
      y0 <- if (run$axis == "row") 1 + below(r, h - 2) else below(r, h - len + 1)
      i <- seq_len(len) - 1
      xs <- if (run$axis == "row") x0 + i else rep(x0, len)
      ys <- if (run$axis == "row") rep(y0, len) else y0 + i
      line <- if (run$axis == "row") y0 else x0
      if (any(vapply(lanes, function(l) l$axis == run$axis && abs(l$lane - line) < 2, logical(1)))) next
      water <- !(key(xs, ys) %in% road)
      xs <- xs[water]
      ys <- ys[water]
      bad <- FALSE
      for (k in seq_along(xs)) {
        if (key(xs[k], ys[k]) %in% reserved || near_taken(xs[k], ys[k])) {
          bad <- TRUE
          break
        }
      }
      if (bad) next
      for (k in seq_along(xs)) grid[ys[k] + 1, xs[k] + 1] <- arrow
      placed <- TRUE
    }
    if (!placed) return(NULL)
  }

  for (piece in shuffle_list(r, pieces)) {
    placed <- FALSE
    t <- 0
    while (t < 300 && !placed) {
      t <- t + 1
      x0 <- 1 + below(r, w - piece$width - 1)
      y0 <- 1 + below(r, h - piece$height - 1)
      xs <- x0 + piece$x
      ys <- y0 + piece$y
      clash <- FALSE
      for (k in seq_along(xs)) {
        around <- key(xs[k] + rep(-1:1, 3), ys[k] + rep(-1:1, each = 3))
        if (any(around %in% road) || any(around %in% reserved) || near_taken(xs[k], ys[k])) {
          clash <- TRUE
          break
        }
      }
      if (clash) next
      for (k in seq_along(xs)) grid[ys[k] + 1, xs[k] + 1] <- "#"
      placed <- TRUE
    }
    if (!placed) return(NULL)
  }

  made <- level
  made$map <- as.list(apply(grid, 1, paste, collapse = ""))
  if (length(vehicles)) made$vehicles <- vehicles else made$vehicles <- NULL
  if (!length(pieces) && !length(runs)) made$map <- NULL
  made
}

# New roads, one for each road in the template. On half of the runs with two or more roads, the
# roads all run the same way. On the other half, at least one runs across and one runs down.
place_lanes <- function(level, r, reserved) {
  groups <- list()
  for (v in level$vehicles) {
    k <- paste0(v$axis, ":", v$lane)
    groups[[k]] <- c(groups[[k]], list(v))
  }
  lists <- unname(groups)
  if (!length(lists)) return(list())
  crossing <- length(lists) >= 2 && r() < 0.5
  for (t in 0:29) {
    if (crossing) {
      axes <- vapply(lists, function(x) if (r() < 0.5) "row" else "column", character(1))
      if (all(axes == axes[1])) axes[below(r, length(axes)) + 1] <- if (axes[1] == "row") "column" else "row"
    } else {
      one <- if ((r() < 0.5) != (t %% 2 == 1)) "row" else "column"
      axes <- rep(one, length(lists))
    }
    lanes <- lane_set(level, r, reserved, lists, axes)
    if (!is.null(lanes)) return(lanes)
  }
  NULL
}

lane_set <- function(level, r, reserved, lists, axes) {
  lanes <- list()
  for (i in seq_along(lists)) {
    axis <- axes[i]
    across <- if (axis == "row") level$height else level$width
    along <- if (axis == "row") level$width else level$height
    options <- numeric(0)
    p <- seq_len(along) - 1
    for (lane in seq(2, across - 3)) {
      cells <- if (axis == "row") key(p, lane) else key(lane, p)
      free <- !any(cells %in% reserved)
      gap_ok <- all(vapply(lanes, function(l) l$axis != axis || abs(l$lane - lane) >= LANE_GAP, logical(1)))
      if (free && gap_ok) options <- c(options, lane)
    }
    if (!length(options)) return(NULL)
    lane <- options[below(r, length(options)) + 1]
    dir <- if (r() < 0.5) 1 else -1
    lanes[[length(lanes) + 1]] <- list(axis = axis, lane = lane, dir = dir, vehicles = lists[[i]])
  }
  lanes
}

place_vehicles <- function(level, r, lanes) {
  out <- list()
  taken <- character(0)
  for (lane in lanes) {
    along <- if (lane$axis == "row") level$width else level$height
    for (template in lane$vehicles) {
      done <- FALSE
      t <- 0
      while (t < 100 && !done) {
        t <- t + 1
        front <- below(r, along)
        p <- (front - lane$dir * seq(-1, template$length)) %% along
        cells <- if (lane$axis == "row") key(p, lane$lane) else key(lane$lane, p)
        if (any(cells %in% taken)) next
        taken <- c(taken, cells)
        v <- template
        v$axis <- lane$axis
        v$lane <- lane$lane
        v$dir <- lane$dir
        v$start <- front
        out[[length(out) + 1]] <- v
        done <- TRUE
      }
      if (!done) return(NULL)
    }
  }
  out
}

# A new maze: passages one cell wide on the even rows and columns, carved by a random walk, then
# opened up so there are no dead ends and no part of the maze is reached through one passage only.
new_maze <- function(level, r) {
  w <- level$width
  h <- level$height
  grid <- matrix("#", h, w)
  cols <- (w + 1) %/% 2
  rows <- (h + 1) %/% 2
  open <- function(x, y) grid[y + 1, x + 1] <<- "."
  seen <- matrix(FALSE, cols, rows)
  seen[1, 1] <- TRUE
  stack <- list(c(0, 0))
  open(0, 0)
  while (length(stack)) {
    cur <- stack[[length(stack)]]
    nxt <- list()
    for (d in shuffle_list(r, SIDES)) {
      nx <- cur[1] + d[1]
      ny <- cur[2] + d[2]
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[nx + 1, ny + 1]) nxt[[length(nxt) + 1]] <- c(nx, ny)
    }
    if (!length(nxt)) {
      stack[[length(stack)]] <- NULL
      next
    }
    n <- nxt[[1]]
    seen[n[1] + 1, n[2] + 1] <- TRUE
    open(cur[1] + n[1], cur[2] + n[2])
    open(n[1] * 2, n[2] * 2)
    stack[[length(stack) + 1]] <- n
  }
  walls_around <- function(x, y) {
    out <- list()
    for (d in SIDES) {
      nx <- x + d[1] * 2
      ny <- y + d[2] * 2
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && grid[y + d[2] + 1, x + d[1] + 1] == "#") out[[length(out) + 1]] <- d
    }
    out
  }
  for (y in seq(0, h - 1, by = 2)) {
    for (x in seq(0, w - 1, by = 2)) {
      walls <- walls_around(x, y)
      exits <- 4 - length(walls) - (if (x == 0 || x == w - 1) 1 else 0) - (if (y == 0 || y == h - 1) 1 else 0)
      if (exits <= 1 && length(walls)) {
        d <- walls[[below(r, length(walls)) + 1]]
        open(x + d[1], y + d[2])
      } else if (length(walls) && r() < 0.12) {
        d <- walls[[below(r, length(walls)) + 1]]
        open(x + d[1], y + d[2])
      }
    }
  }
  sy <- level$start$y - level$start$y %% 2
  sx <- level$start$x
  for (x in seq(max(0, sx - 3), min(w - 1, sx + 4))) open(x, sy)
  made <- function() {
    m <- level
    m$start$y <- sy
    m$map <- as.list(apply(grid, 1, paste, collapse = ""))
    m
  }
  for (i in seq_len(200)) {
    bridges <- narrow_passages(made())
    if (!length(bridges)) break
    bridge <- bridges[[1]]
    blocked <- obstacle_keys(made())
    side <- reachable(made(), blocked, bridge[1], bridge[2])
    doors <- list()
    for (y in seq_len(h) - 1) {
      for (x in seq_len(w) - 1) {
        if (grid[y + 1, x + 1] != "#" || (x %% 2) + (y %% 2) != 1) next
        if (x %% 2 == 1) {
          a <- c(x - 1, y)
          b <- c(x + 1, y)
        } else {
          a <- c(x, y - 1)
          b <- c(x, y + 1)
        }
        ka <- key(a[1], a[2])
        kb <- key(b[1], b[2])
        if (ka %in% blocked || kb %in% blocked || !in_board(level, a) || !in_board(level, b)) next
        if ((ka %in% side) != (kb %in% side)) doors[[length(doors) + 1]] <- c(x, y)
      }
    }
    if (!length(doors)) break
    d <- doors[[below(r, length(doors)) + 1]]
    open(d[1], d[2])
  }
  made()
}

in_board <- function(level, p) p[1] >= 0 && p[2] >= 0 && p[1] < level$width && p[2] < level$height

reachable <- function(level, blocked, from, not) {
  seen <- from
  stack <- from
  while (length(stack)) {
    k <- stack[length(stack)]
    stack <- stack[-length(stack)]
    xy <- split_key(k)
    for (d in SIDES) {
      p <- c(xy[1] + d[1], xy[2] + d[2])
      nk <- key(p[1], p[2])
      if (nk %in% seen || nk %in% blocked || !in_board(level, p) || (nk == not && k == from)) next
      seen <- c(seen, nk)
      stack <- c(stack, nk)
    }
  }
  seen
}

# The passages that are the only way into a part of the board, as pairs of "x,y" keys.
narrow_passages <- function(level) {
  blocked <- obstacle_keys(level)
  env <- new.env()
  env$order <- list()
  env$low <- list()
  env$time <- 0
  env$found <- list()
  visit <- function(u, parent) {
    env$order[[u]] <- env$time
    env$low[[u]] <- env$time
    env$time <- env$time + 1
    xy <- split_key(u)
    for (d in SIDES) {
      p <- c(xy[1] + d[1], xy[2] + d[2])
      v <- key(p[1], p[2])
      if ((!is.null(parent) && v == parent) || v %in% blocked || !in_board(level, p)) next
      if (!is.null(env$order[[v]])) {
        env$low[[u]] <- min(env$low[[u]], env$order[[v]])
      } else {
        visit(v, u)
        env$low[[u]] <- min(env$low[[u]], env$low[[v]])
        if (env$low[[v]] > env$order[[u]]) env$found[[length(env$found) + 1]] <- c(u, v)
      }
    }
  }
  visit(key(level$start$x, level$start$y), NULL)
  env$found
}
