"""The levels, read from the data files in the levels/ folder at the top of the repo.

The web game reads the same files, so a change to a level shows up in all three games.
A level stays a plain dict, shaped exactly like its JSON file.
"""

import json
import os
import re
from pathlib import Path

CURRENT = {"<": "left", ">": "right", "^": "up", "v": "down"}


def levels_dir() -> Path:
    """The levels/ folder: SANKOFA_LEVELS if it is set, or the one at the top of this repo."""
    env = os.environ.get("SANKOFA_LEVELS")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "levels" / "01-farm.json").exists():
            return parent / "levels"
    raise FileNotFoundError("Can't find the levels folder. Set SANKOFA_LEVELS to its path.")


def load_levels(folder: Path | None = None) -> list[dict]:
    """Every level file, in the order of their numbers."""
    folder = folder or levels_dir()
    files = sorted(p for p in folder.glob("*.json") if re.match(r"^\d+-", p.name))
    levels = [json.loads(p.read_text(encoding="utf-8")) for p in files]
    levels.sort(key=lambda level: level["number"])
    return levels


LEVELS = load_levels()


def obstacle_keys(level: dict) -> dict[tuple[int, int], None]:
    """The obstacle cells of a level, in reading order. A dict keeps the order, like a Set in TypeScript."""
    keys: dict[tuple[int, int], None] = {}
    for y, row in enumerate(level.get("map") or []):
        for x, ch in enumerate(row):
            if ch == "#":
                keys[(x, y)] = None
    return keys


def current_keys(level: dict) -> dict[tuple[int, int], str]:
    """The current cells of a level, with the way each one pushes."""
    keys: dict[tuple[int, int], str] = {}
    for y, row in enumerate(level.get("map") or []):
        for x, ch in enumerate(row):
            if ch in CURRENT:
                keys[(x, y)] = CURRENT[ch]
    return keys


BACK = {"up": (0, 1), "down": (0, -1), "left": (1, 0), "right": (-1, 0)}


def validate_level(level: dict) -> list[str]:
    """Checks a level for mistakes. Returns a list of problems, empty when the level is fine."""
    problems: list[str] = []
    width, height, start, speed = level["width"], level["height"], level["start"], level["speed"]
    if not isinstance(width, int) or not isinstance(height, int) or width < 8 or height < 8:
        problems.append("the board must be whole numbers of cells, at least 8 by 8")
    if level.get("map"):
        if len(level["map"]) != height:
            problems.append(f"the map has {len(level['map'])} rows, expected {height}")
        for y, row in enumerate(level["map"]):
            if len(row) != width:
                problems.append(f"map row {y} has {len(row)} cells, expected {width}")
            if re.search(r"[^.#<>^v]", row):
                problems.append(f"map row {y} uses a character other than the ones allowed")
    if speed["start"] <= 0 or speed["max"] < speed["start"] or speed["step"] < 0 or speed["every"] < 1:
        problems.append("the speed settings don't make sense")
    if level["goal"] < 1:
        problems.append("the goal must be at least one cowrie")
    if level["stars"][0] > level["stars"][1]:
        problems.append("the three-star score must be at least the two-star score")

    obstacles = obstacle_keys(level)
    currents = current_keys(level)
    lanes: set[tuple[int, int]] = set()
    for i, v in enumerate(level.get("vehicles") or []):
        across = height if v["axis"] == "row" else width
        along = width if v["axis"] == "row" else height
        if not isinstance(v["lane"], int) or v["lane"] < 0 or v["lane"] >= across:
            problems.append(f"vehicle {i} drives on a lane off the board")
        if v["length"] < 1 or v["length"] >= along:
            problems.append(f"vehicle {i} must be shorter than its lane")
        if not isinstance(v["every"], int) or v["every"] < 1:
            problems.append(f"vehicle {i} must move every 1 or more snake moves")
        if v["start"] < 0 or v["start"] >= along:
            problems.append(f"vehicle {i} starts off the board")
        for p in range(along):
            c = (p, v["lane"]) if v["axis"] == "row" else (v["lane"], p)
            lanes.add(c)
            if c in obstacles:
                problems.append(f"vehicle {i} drives through the obstacle at {c[0]},{c[1]}")
            if c in currents:
                problems.append(f"vehicle {i} drives through the current at {c[0]},{c[1]}")

    p = level.get("powerUps")
    if p:
        if not p["kinds"] or any(k not in ("slow", "shrink", "pass") for k in p["kinds"]):
            problems.append('power-up kinds must be some of "slow", "shrink" and "pass"')
        if not isinstance(p["every"], int) or p["every"] < 1:
            problems.append("power-ups must appear every 1 or more cowries")
        if not isinstance(p["lasts"], int) or p["lasts"] < 1:
            problems.append("power-ups must last 1 or more moves")

    bx, by = BACK[start["dir"]]
    for i in range(start["length"]):
        x = start["x"] + bx * i
        y = start["y"] + by * i
        if x < 0 or y < 0 or x >= width or y >= height:
            problems.append(f"start cell {x},{y} is off the board")
        elif (x, y) in obstacles:
            problems.append(f"start cell {x},{y} is on an obstacle")
        elif (x, y) in lanes:
            problems.append(f"start cell {x},{y} is on a vehicle's lane")
        elif (x, y) in currents:
            problems.append(f"start cell {x},{y} is on a current")
    return problems
