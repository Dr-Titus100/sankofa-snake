"""New layouts for every run, ported from packages/core/src/layout.ts.

A level file is a template: its map says which obstacle pieces, currents and roads the level has,
and new_layout() places them somewhere new. The Maze builds a new maze instead. The same seed gives
the same layout here as in the web game, so the daily challenge looks the same in every version.
"""

from __future__ import annotations

import sys

from .levels import obstacle_keys, validate_level
from .rng import Rand, seed_from

sys.setrecursionlimit(max(sys.getrecursionlimit(), 10000))

TRIES = 80
LANE_GAP = 4
SIDES = ((1, 0), (-1, 0), (0, 1), (0, -1))
STEP = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}


def layout_seed(seed: int) -> int:
    """The seed for a run's layout. It differs from the seed for the cowries."""
    return seed_from(f"sankofa-layout:{seed & 0xFFFFFFFF}")


def _shuffle(r: Rand, items: list) -> list:
    out = list(items)
    for i in range(len(out) - 1, 0, -1):
        j = r.below(i + 1)
        out[i], out[j] = out[j], out[i]
    return out


def obstacle_pieces(level: dict) -> list[dict]:
    """The pieces of obstacle in a map: groups of "#" cells that touch side by side."""
    left = obstacle_keys(level)
    pieces = []
    for start in list(left):
        if start not in left:
            continue
        found = []
        stack = [start]
        del left[start]
        while stack:
            x, y = stack.pop()
            found.append((x, y))
            for dx, dy in SIDES:
                k = (x + dx, y + dy)
                if k in left:
                    del left[k]
                    stack.append(k)
        min_x = min(c[0] for c in found)
        min_y = min(c[1] for c in found)
        cells = [(x - min_x, y - min_y) for x, y in found]
        pieces.append({
            "cells": cells,
            "width": max(c[0] for c in cells) + 1,
            "height": max(c[1] for c in cells) + 1,
        })
    return pieces


def current_runs(level: dict) -> list[dict]:
    """The currents in a map, as straight runs: "<" and ">" along a row, "^" and "v" down a column."""
    m = level.get("map") or []
    runs = []

    def at(x: int, y: int):
        if y < 0 or y >= len(m) or x < 0 or x >= len(m[y]):
            return None
        return m[y][x]

    for y, row in enumerate(m):
        for x, ch in enumerate(row):
            if ch in "<>" and at(x - 1, y) != ch:
                n = 0
                while at(x + n, y) == ch:
                    n += 1
                runs.append({"axis": "row", "length": n})
            if ch in "^v" and at(x, y - 1) != ch:
                n = 0
                while at(x, y + n) == ch:
                    n += 1
                runs.append({"axis": "column", "length": n})
    return runs


def start_zone(level: dict) -> list[tuple[int, int]]:
    """The snake's starting cells and the four cells ahead of its head."""
    s = level["start"]
    dx, dy = STEP[s["dir"]]
    cells = [(s["x"] + dx * i, s["y"] + dy * i) for i in range(-(s["length"] - 1), 5)]
    return [(x, y) for x, y in cells if 0 <= x < level["width"] and 0 <= y < level["height"]]


def all_open_connected(level: dict) -> bool:
    """Every open cell can be reached from the snake's head without wrapping around an edge."""
    blocked = obstacle_keys(level)
    width, height = level["width"], level["height"]
    open_count = width * height - len(blocked)
    first = (level["start"]["x"], level["start"]["y"])
    if first in blocked:
        return False
    seen = {first}
    stack = [first]
    while stack:
        x, y = stack.pop()
        for dx, dy in SIDES:
            nx, ny = x + dx, y + dy
            k = (nx, ny)
            if nx < 0 or ny < 0 or nx >= width or ny >= height or k in seen or k in blocked:
                continue
            seen.add(k)
            stack.append(k)
    return len(seen) == open_count


def new_layout(level: dict, seed: int) -> dict:
    """A new layout for a level. If no fair layout turns up after many tries, the level keeps its own map."""
    mode = level.get("layout") or "shuffle"
    if mode == "fixed":
        return level
    if mode == "maze":
        return _new_maze(level, Rand(seed))
    if not level.get("map") and not level.get("vehicles"):
        return level
    r = Rand(seed)
    pieces = obstacle_pieces(level)
    runs = current_runs(level)
    for _ in range(TRIES):
        made = _try_shuffle(level, r, pieces, runs)
        if made and all_open_connected(made) and not validate_level(made):
            return made
    return level


def _try_shuffle(level: dict, r: Rand, pieces: list, runs: list):
    width, height = level["width"], level["height"]
    grid = [["."] * width for _ in range(height)]

    def inside(x, y):
        return 0 <= x < width and 0 <= y < height

    reserved = set()
    for x, y in start_zone(level):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                reserved.add((x + dx, y + dy))

    lanes = _place_lanes(level, r, reserved)
    if lanes is None:
        return None
    road = set()
    for lane in lanes:
        along = width if lane["axis"] == "row" else height
        for p in range(along):
            road.add((p, lane["lane"]) if lane["axis"] == "row" else (lane["lane"], p))
    vehicles = _place_vehicles(level, r, lanes)
    if vehicles is None:
        return None

    def near_taken(x, y):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if inside(nx, ny) and grid[ny][nx] != ".":
                    return True
        return False

    for run in runs:
        placed = False
        t = 0
        while t < 200 and not placed:
            t += 1
            flip = r() < 0.5
            if run["axis"] == "row":
                arrow = "<" if flip else ">"
            else:
                arrow = "^" if flip else "v"
            length = min(run["length"], width if run["axis"] == "row" else height)
            x0 = r.below(width - length + 1) if run["axis"] == "row" else 1 + r.below(width - 2)
            y0 = 1 + r.below(height - 2) if run["axis"] == "row" else r.below(height - length + 1)
            cells = [(x0 + i, y0) if run["axis"] == "row" else (x0, y0 + i) for i in range(length)]
            line = y0 if run["axis"] == "row" else x0
            if any(l["axis"] == run["axis"] and abs(l["lane"] - line) < 2 for l in lanes):
                continue
            water = [c for c in cells if c not in road]
            if any(c in reserved or near_taken(*c) for c in water):
                continue
            for x, y in water:
                grid[y][x] = arrow
            placed = True
        if not placed:
            return None

    for piece in _shuffle(r, pieces):
        placed = False
        t = 0
        while t < 300 and not placed:
            t += 1
            x0 = 1 + r.below(width - piece["width"] - 1)
            y0 = 1 + r.below(height - piece["height"] - 1)
            cells = [(x0 + x, y0 + y) for x, y in piece["cells"]]

            def clash(x, y):
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        k = (x + dx, y + dy)
                        if k in road or k in reserved:
                            return True
                return near_taken(x, y)

            if any(clash(x, y) for x, y in cells):
                continue
            for x, y in cells:
                grid[y][x] = "#"
            placed = True
        if not placed:
            return None

    made = {**level, "map": ["".join(row) for row in grid]}
    if vehicles:
        made["vehicles"] = vehicles
    else:
        made.pop("vehicles", None)
    if not pieces and not runs:
        made.pop("map", None)
    return made


def _place_lanes(level: dict, r: Rand, reserved: set):
    groups: dict[str, list] = {}
    for v in level.get("vehicles") or []:
        groups.setdefault(f"{v['axis']}:{v['lane']}", []).append(v)
    lists = list(groups.values())
    if not lists:
        return []
    crossing = len(lists) >= 2 and r() < 0.5
    for t in range(30):
        if crossing:
            axes = ["row" if r() < 0.5 else "column" for _ in lists]
            if all(a == axes[0] for a in axes):
                axes[r.below(len(axes))] = "column" if axes[0] == "row" else "row"
        else:
            one = "row" if (r() < 0.5) != (t % 2 == 1) else "column"
            axes = [one for _ in lists]
        lanes = _lane_set(level, r, reserved, lists, axes)
        if lanes is not None:
            return lanes
    return None


def _lane_set(level, r: Rand, reserved, lists, axes):
    lanes = []
    for i, vs in enumerate(lists):
        axis = axes[i]
        across = level["height"] if axis == "row" else level["width"]
        along = level["width"] if axis == "row" else level["height"]
        options = []
        for lane in range(2, across - 2):
            free = all(((p, lane) if axis == "row" else (lane, p)) not in reserved for p in range(along))
            if free and all(l["axis"] != axis or abs(l["lane"] - lane) >= LANE_GAP for l in lanes):
                options.append(lane)
        if not options:
            return None
        lane = options[r.below(len(options))]
        d = 1 if r() < 0.5 else -1
        lanes.append({"axis": axis, "lane": lane, "dir": d, "vehicles": vs})
    return lanes


def _place_vehicles(level, r: Rand, lanes):
    out = []
    taken = set()
    for lane in lanes:
        along = level["width"] if lane["axis"] == "row" else level["height"]
        for template in lane["vehicles"]:
            done = False
            t = 0
            while t < 100 and not done:
                t += 1
                front = r.below(along)
                cells = []
                for i in range(-1, template["length"] + 1):
                    p = (front - lane["dir"] * i) % along
                    cells.append((p, lane["lane"]) if lane["axis"] == "row" else (lane["lane"], p))
                if any(k in taken for k in cells):
                    continue
                taken.update(cells)
                out.append({**template, "axis": lane["axis"], "lane": lane["lane"], "dir": lane["dir"], "start": front})
                done = True
            if not done:
                return None
    return out


def _new_maze(level: dict, r: Rand) -> dict:
    width, height = level["width"], level["height"]
    grid = [["#"] * width for _ in range(height)]
    cols = (width + 1) // 2
    rows = (height + 1) // 2

    def open_(x, y):
        grid[y][x] = "."

    seen = {(0, 0)}
    stack = [(0, 0)]
    open_(0, 0)
    while stack:
        cx, cy = stack[-1]
        nxt = [
            (cx + dx, cy + dy)
            for dx, dy in _shuffle(r, list(SIDES))
            if 0 <= cx + dx < cols and 0 <= cy + dy < rows and (cx + dx, cy + dy) not in seen
        ]
        if not nxt:
            stack.pop()
            continue
        nx, ny = nxt[0]
        seen.add((nx, ny))
        open_(cx + nx, cy + ny)
        open_(nx * 2, ny * 2)
        stack.append((nx, ny))

    def walls_around(x, y):
        return [
            (dx, dy)
            for dx, dy in SIDES
            if 0 <= x + dx * 2 < width and 0 <= y + dy * 2 < height and grid[y + dy][x + dx] == "#"
        ]

    for y in range(0, height, 2):
        for x in range(0, width, 2):
            walls = walls_around(x, y)
            exits = 4 - len(walls) - (1 if x == 0 or x == width - 1 else 0) - (1 if y == 0 or y == height - 1 else 0)
            if exits <= 1 and walls:
                dx, dy = walls[r.below(len(walls))]
                open_(x + dx, y + dy)
            elif walls and r() < 0.12:
                dx, dy = walls[r.below(len(walls))]
                open_(x + dx, y + dy)

    sy = level["start"]["y"] - level["start"]["y"] % 2
    sx = level["start"]["x"]
    for x in range(max(0, sx - 3), min(width - 1, sx + 4) + 1):
        open_(x, sy)

    def made():
        return {**level, "start": {**level["start"], "y": sy}, "map": ["".join(row) for row in grid]}

    for _ in range(200):
        bridges = narrow_passages(made())
        if not bridges:
            break
        bridge = bridges[0]
        blocked = obstacle_keys(made())
        side = _reachable(made(), blocked, bridge[0], bridge[1])
        doors = []
        for y in range(height):
            for x in range(width):
                if grid[y][x] != "#" or (x % 2) + (y % 2) != 1:
                    continue
                a, b = ((x - 1, y), (x + 1, y)) if x % 2 else ((x, y - 1), (x, y + 1))
                if a in blocked or b in blocked or not _in_board(level, a) or not _in_board(level, b):
                    continue
                if (a in side) != (b in side):
                    doors.append((x, y))
        if not doors:
            break
        dx, dy = doors[r.below(len(doors))]
        open_(dx, dy)
    return made()


def _in_board(level, k) -> bool:
    return 0 <= k[0] < level["width"] and 0 <= k[1] < level["height"]


def _reachable(level, blocked, frm, not_):
    seen = {frm}
    stack = [frm]
    while stack:
        x, y = stack.pop()
        for dx, dy in SIDES:
            k = (x + dx, y + dy)
            if k in seen or k in blocked or not _in_board(level, k) or (k == not_ and (x, y) == frm):
                continue
            seen.add(k)
            stack.append(k)
    return seen


def narrow_passages(level: dict) -> list:
    """The passages that are the only way into a part of the board, as pairs of cells."""
    blocked = obstacle_keys(level)
    found = []
    order: dict = {}
    low: dict = {}
    time = [0]

    def visit(u, parent):
        order[u] = time[0]
        low[u] = time[0]
        time[0] += 1
        x, y = u
        for dx, dy in SIDES:
            v = (x + dx, y + dy)
            if v == parent or v in blocked or not _in_board(level, v):
                continue
            if v in order:
                low[u] = min(low[u], order[v])
            else:
                visit(v, u)
                low[u] = min(low[u], low[v])
                if low[v] > order[u]:
                    found.append((u, v))

    visit((level["start"]["x"], level["start"]["y"]), None)
    return found
