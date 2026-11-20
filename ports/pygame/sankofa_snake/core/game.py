"""The rules of Sankofa Snake, ported line by line from packages/core/src/game.ts.

Nothing here draws anything or reads the keyboard. Every function takes a game state and returns
a new one, and the old state is never changed. The tests in ports/pygame/tests replay runs
recorded from the TypeScript rules and check that every move comes out the same.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace
from typing import Optional

from .levels import current_keys, obstacle_keys
from .rng import next_random

Cell = tuple[int, int]

STEP = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
OPPOSITE = {"up": "down", "down": "up", "left": "right", "right": "left"}

#: The most turns a player can press ahead of the snake.
MAX_QUEUED_TURNS = 2
#: How many moves slow motion lasts.
SLOW_MOVES = 40
SLOW_SHARE = 0.6
MIN_SPEED = 3
# Swimming along a current, the way the snake is heading, the snake moves this much faster.
CURRENT_BOOST = 1.5
#: How many cells the shrink power-up takes off the tail.
SHRINK_CELLS = 4
MIN_LENGTH = 3


def js_round(x: float) -> int:
    """Rounds the way JavaScript's Math.round does: halves go up."""
    return math.floor(x + 0.5)


@dataclass(frozen=True)
class PowerUp:
    kind: str
    at: Cell
    until: int


@dataclass(frozen=True)
class GameState:
    level: dict
    snake: tuple[Cell, ...]
    dir: str
    last_step: str
    queue: tuple[str, ...]
    food: Optional[Cell]
    obstacles: dict
    currents: dict
    eaten: int
    score: int
    speed: int
    speed_level: int
    grow: int
    elapsed_ms: float
    moves: int
    vehicles: tuple[int, ...]
    power_up: Optional[PowerUp]
    slow_until: int
    passes: int
    status: str
    rng: int
    crash: Optional[str] = None
    crash_vehicle: Optional[str] = None
    bump: Optional[str] = None
    crash_pushed: bool = False
    crash_at: Optional[Cell] = None


def wrap_cell(c: Cell, level: dict) -> Cell:
    return (c[0] % level["width"], c[1] % level["height"])


def create_game(level: dict, seed: int) -> GameState:
    """Starts a level. The snake waits until the player picks a direction."""
    start = level["start"]
    bx, by = STEP[OPPOSITE[start["dir"]]]
    snake = tuple(wrap_cell((start["x"] + bx * i, start["y"] + by * i), level) for i in range(start["length"]))
    state = GameState(
        level=level,
        snake=snake,
        dir=start["dir"],
        last_step=start["dir"],
        queue=(),
        food=None,
        obstacles=obstacle_keys(level),
        currents=current_keys(level),
        eaten=0,
        score=0,
        speed=level["speed"]["start"],
        speed_level=1,
        grow=0,
        elapsed_ms=0.0,
        moves=0,
        vehicles=tuple(v["start"] for v in level.get("vehicles") or []),
        power_up=None,
        slow_until=0,
        passes=0,
        status="ready",
        rng=seed & 0xFFFFFFFF,
    )
    return place_food(state)


def turn(state: GameState, d: str) -> GameState:
    """Records a turn. A turn back the way the snake came is ignored. The first accepted one starts the game."""
    if state.status not in ("ready", "running"):
        return state
    last = state.queue[-1] if state.queue else state.dir
    if d == OPPOSITE[last]:
        return state
    if not state.queue and d == OPPOSITE[state.last_step]:
        return state
    if d == last or len(state.queue) >= MAX_QUEUED_TURNS:
        return replace(state, status="running")
    return replace(state, status="running", queue=state.queue + (d,))


def toggle_pause(state: GameState) -> GameState:
    if state.status == "running":
        return replace(state, status="paused")
    if state.status == "paused":
        return replace(state, status="running")
    return state


def pause(state: GameState) -> GameState:
    return replace(state, status="paused") if state.status == "running" else state


def is_slow(state: GameState) -> bool:
    return state.moves < state.slow_until


def riding_current(state: GameState) -> bool:
    """Whether the head is on a current that flows the way the snake is heading."""
    return bool(state.snake) and state.currents.get(state.snake[0]) == state.dir


def speed_now(state: GameState) -> float:
    speed = max(MIN_SPEED, js_round(state.speed * SLOW_SHARE)) if is_slow(state) else state.speed
    return js_round(speed * CURRENT_BOOST) if riding_current(state) else speed


def move_ms(state: GameState) -> float:
    return 1000 / speed_now(state)


def tick(state: GameState) -> tuple[GameState, list[dict]]:
    """Moves the snake one cell. When the head crosses a current, it is carried one more cell sideways."""
    if state.status != "running":
        return state, []
    events: list[dict] = []
    level = state.level

    queue = list(state.queue)
    while queue and (queue[0] == OPPOSITE[state.last_step] or queue[0] == OPPOSITE[state.dir]):
        queue.pop(0)
    d = queue.pop(0) if queue else state.dir
    moves = state.moves + 1
    vehicles = move_vehicles(level, state.vehicles, moves, state.snake)
    power_up = state.power_up
    if power_up and moves >= power_up.until:
        power_up = None
        events.append({"type": "powerGone"})
    elapsed_ms = state.elapsed_ms + move_ms(state)
    moved = replace(state, moves=moves, vehicles=vehicles, power_up=power_up, queue=tuple(queue), elapsed_ms=elapsed_ms)

    nxt = _move_once(moved, d, d, events, False)
    push = nxt.currents.get(nxt.snake[0]) if nxt.status == "running" else None
    if push and push != d and push != OPPOSITE[d]:
        events.append({"type": "current", "dir": push})
        nxt = _move_once(nxt, push, d, events, True)
    return nxt, events


def _move_once(state: GameState, step: str, heading: str, events: list, pushed: bool) -> GameState:
    level = state.level
    hx, hy = state.snake[0]
    nx, ny = hx + STEP[step][0], hy + STEP[step][1]

    def fail(cause: str, vehicle: Optional[str] = None) -> GameState:
        return _crash(state, cause, (nx, ny), heading, events, pushed, vehicle)

    outside = nx < 0 or ny < 0 or nx >= level["width"] or ny >= level["height"]
    if outside and level["edges"] == "walls":
        return fail("wall")
    nx, ny = wrap_cell((nx, ny), level)
    nxt: Cell = (nx, ny)

    if nxt in state.obstacles:
        return fail("obstacle")
    vehicle = _vehicle_at(level, state.vehicles, nxt)
    if vehicle:
        return fail("vehicle", vehicle)

    eating = state.food is not None and nxt == state.food
    tail_moves = not eating and state.grow == 0
    body = state.snake[:-1] if tail_moves else state.snake
    passes, power_up = state.passes, state.power_up
    if nxt in body:
        if passes == 0:
            return fail("self")
        passes -= 1
        events.append({"type": "passed"})

    snake = (nxt,) + tuple(body)
    grow, eaten, score, speed, speed_level, slow_until = (
        state.grow, state.eaten, state.score, state.speed, state.speed_level, state.slow_until,
    )
    if not eating and grow > 0:
        grow -= 1

    if power_up and nxt == power_up.at:
        if power_up.kind == "slow":
            slow_until = state.moves + SLOW_MOVES
        if power_up.kind == "pass":
            passes += 1
        if power_up.kind == "shrink":
            snake = snake[: max(MIN_LENGTH, len(snake) - SHRINK_CELLS)]
            grow = 0
        events.append({"type": "power", "kind": power_up.kind})
        power_up = None

    next_state = replace(
        state, snake=snake, dir=heading, last_step=step, grow=grow, power_up=power_up,
        slow_until=slow_until, passes=passes, bump=None,
    )
    if not eating:
        return next_state

    eaten += 1
    points = 10 * speed_level
    score += points
    events.append({"type": "ate", "at": nxt, "points": points})

    if eaten >= level["goal"]:
        time_bonus = max(0, js_round(level["parSeconds"] - state.elapsed_ms / 1000)) * 5
        score += time_bonus
        stars = stars_for(level, score)
        events.append({"type": "cleared", "score": score, "stars": stars, "timeBonus": time_bonus})
        return replace(next_state, eaten=eaten, score=score, food=None, status="cleared")

    s = level["speed"]
    if s["step"] > 0 and eaten % s["every"] == 0 and speed < s["max"]:
        speed = min(s["max"], speed + s["step"])
        speed_level += 1
        events.append({"type": "speedup", "speed": speed})

    next_state = place_food(replace(next_state, eaten=eaten, score=score, speed=speed, speed_level=speed_level))
    rule = level.get("powerUps")
    if rule and rule["kinds"] and eaten % rule["every"] == 0 and not next_state.power_up:
        next_state = place_power_up(next_state)
        if next_state.power_up:
            events.append({"type": "powerAppeared", "kind": next_state.power_up.kind, "at": next_state.power_up.at})
    return next_state


def stars_for(level: dict, score: int) -> int:
    """One star for clearing the level, and one more for each score threshold reached."""
    return 1 + (1 if score >= level["stars"][0] else 0) + (1 if score >= level["stars"][1] else 0)


def _crash(state, cause, at, d, events, pushed, vehicle=None) -> GameState:
    if state.level.get("practice"):
        events.append({"type": "bump", "cause": cause})
        return replace(state, dir=state.last_step, queue=(), status="ready", bump=cause)
    events.append({"type": "crash", "cause": cause})
    return replace(
        state, dir=d, queue=(), status="over", crash=cause, crash_at=at,
        crash_vehicle=vehicle, crash_pushed=bool(pushed),
    )


def vehicle_cells(v: dict, level: dict, front: int) -> list[Cell]:
    """The cells a vehicle covers when its front is at the given place along its lane, front first."""
    lane_length = level["width"] if v["axis"] == "row" else level["height"]
    cells = []
    for i in range(v["length"]):
        along = (front - v["dir"] * i) % lane_length
        cells.append((along, v["lane"]) if v["axis"] == "row" else (v["lane"], along))
    return cells


def vehicle_keys(state: GameState) -> set[Cell]:
    keys: set[Cell] = set()
    for i, v in enumerate(state.level.get("vehicles") or []):
        keys.update(vehicle_cells(v, state.level, state.vehicles[i]))
    return keys


def _vehicle_at(level: dict, fronts, c: Cell) -> Optional[str]:
    for i, v in enumerate(level.get("vehicles") or []):
        if c in vehicle_cells(v, level, fronts[i]):
            return v["kind"]
    return None


def move_vehicles(level: dict, fronts, moves: int, snake) -> tuple[int, ...]:
    """Moves each vehicle one cell when its turn comes. It waits while the snake or another vehicle is in the way."""
    vs = level.get("vehicles") or []
    if not vs:
        return tuple(fronts)
    nxt = list(fronts)
    snake_keys = set(snake)
    for i, v in enumerate(vs):
        if moves % v["every"] != 0:
            continue
        ahead = vehicle_cells(v, level, nxt[i] + v["dir"])[0]
        blocked = ahead in snake_keys or any(
            j != i and ahead in vehicle_cells(o, level, nxt[j]) for j, o in enumerate(vs)
        )
        if not blocked:
            lane_length = level["width"] if v["axis"] == "row" else level["height"]
            nxt[i] = (nxt[i] + v["dir"]) % lane_length
    return tuple(nxt)


def _open_cells(state: GameState, food: Optional[Cell], power_at: Optional[Cell]) -> list[Cell]:
    taken = set(state.snake)
    taken.update(vehicle_keys(state))
    if food:
        taken.add(food)
    if power_at:
        taken.add(power_at)
    out = []
    for y in range(state.level["height"]):
        for x in range(state.level["width"]):
            if (x, y) not in taken and (x, y) not in state.obstacles:
                out.append((x, y))
    return out


def place_food(state: GameState) -> GameState:
    """Puts a cowrie on a random open cell."""
    cells = _open_cells(state, None, state.power_up.at if state.power_up else None)
    if not cells:
        return replace(state, food=None)
    r, rng = next_random(state.rng)
    return replace(state, food=cells[int(r * len(cells))], rng=rng)


def place_power_up(state: GameState, kind: Optional[str] = None) -> GameState:
    """Puts a power-up of a random kind from the level's list on a random open cell."""
    rule = state.level.get("powerUps")
    if not rule or not rule["kinds"]:
        return state
    rng = state.rng
    if not kind:
        r, rng = next_random(rng)
        kind = rule["kinds"][int(r * len(rule["kinds"]))]
    cells = _open_cells(state, state.food, None)
    if not cells:
        return replace(state, rng=rng)
    r, rng = next_random(rng)
    return replace(state, power_up=PowerUp(kind, cells[int(r * len(cells))], state.moves + rule["lasts"]), rng=rng)
