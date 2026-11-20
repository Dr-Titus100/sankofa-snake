"""Checks that the Python rules play exactly the same game as the TypeScript rules.

The runs in ports/reference/fixtures.json were recorded from packages/core. Each one is replayed
here with the same seed and the same key presses, and every move must give the same state.
"""

import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sankofa_snake.core import (  # noqa: E402
    LEVELS,
    create_game,
    daily_level,
    daily_seed,
    free_play_level,
    layout_seed,
    new_layout,
    next_random,
    practice_level,
    seed_from,
    tick,
    toggle_pause,
    turn,
)
from sankofa_snake.paints import vehicle_paints  # noqa: E402

FIXTURES = json.loads((Path(__file__).resolve().parents[2] / "reference" / "fixtures.json").read_text())
BY_ID = {level["id"]: level for level in LEVELS}


def cell(c):
    return f"{c[0]},{c[1]}" if c else "-"


def layout_line(level):
    m = "/".join(level.get("map") or [])
    vs = ";".join(
        ",".join(str(v[k]) for k in ("kind", "axis", "lane", "dir", "length", "every", "start"))
        for v in level.get("vehicles") or []
    )
    s = level["start"]
    return f"{m}|{vs}|{s['x']},{s['y']},{s['dir']},{s['length']}"


def state_line(s):
    p = f"{s.power_up.kind}@{s.power_up.at[0]},{s.power_up.at[1]}<{s.power_up.until}" if s.power_up else "-"
    return "|".join(str(v) for v in [
        s.status, s.dir, s.last_step, ",".join(s.queue), " ".join(cell(c) for c in s.snake), cell(s.food),
        s.eaten, s.score, s.speed, s.speed_level, s.grow, math.floor(s.elapsed_ms), s.moves,
        ",".join(str(v) for v in s.vehicles), p, s.slow_until, s.passes, s.crash or "-", s.crash_vehicle or "-",
        s.bump or "-", 1 if s.crash_pushed else 0, cell(s.crash_at), s.rng,
    ])


def event_text(e):
    t = e["type"]
    if t == "ate":
        return f"ate:{cell(e['at'])}:{e['points']}"
    if t == "speedup":
        return f"speedup:{e['speed']}"
    if t in ("crash", "bump"):
        return f"{t}:{e['cause']}"
    if t == "power":
        return f"power:{e['kind']}"
    if t == "powerAppeared":
        return f"powerAppeared:{e['kind']}:{cell(e['at'])}"
    if t == "current":
        return f"current:{e['dir']}"
    if t == "cleared":
        return f"cleared:{e['score']}:{e['stars']}:{e['timeBonus']}"
    return t


def level_for(run):
    mode = run["mode"]
    if mode == "daily":
        seed = daily_seed(run["level"])
        return new_layout(daily_level(run["level"]), layout_seed(seed))
    base = BY_ID[run["level"]]
    if mode == "levels":
        return new_layout(base, layout_seed(run["seed"]))
    if mode == "practice":
        return new_layout(practice_level(base), layout_seed(run["seed"]))
    if mode == "free":
        return new_layout(free_play_level(base, run["edges"]), layout_seed(run["seed"]))
    return base


class RandomNumbers(unittest.TestCase):
    def test_seeds(self):
        for item in FIXTURES["seeds"]:
            self.assertEqual(seed_from(item["text"]), item["seed"], item["text"])

    def test_sequence(self):
        state = 42
        for value, nxt in FIXTURES["randoms"]:
            got, state = next_random(state)
            self.assertEqual(got, value)
            self.assertEqual(state, nxt)


class Layouts(unittest.TestCase):
    def test_layouts(self):
        for item in FIXTURES["layouts"]:
            made = new_layout(BY_ID[item["level"]], item["seed"])
            line = layout_line(made)
            if "line" in item:
                self.assertEqual(line, item["line"], f"{item['level']} seed {item['seed']}")
            self.assertEqual(f"{seed_from(line):08x}", item["hash"], f"{item['level']} seed {item['seed']}")

    def test_vehicle_paints(self):
        for item in FIXTURES["paints"]:
            made = new_layout(BY_ID[item["level"]], item["seed"])
            self.assertEqual(vehicle_paints(made), item["paints"], f"{item['level']} seed {item['seed']}")


class Daily(unittest.TestCase):
    def test_daily_levels(self):
        for item in FIXTURES["daily"]:
            level = daily_level(item["date"])
            self.assertEqual(level["id"], item["id"])
            self.assertEqual(level["world"], item["world"])
            self.assertEqual(level["challenge"], item["challenge"])
            self.assertEqual(level["edges"], item["edges"])
            sp = level["speed"]
            self.assertEqual([sp["start"], sp["step"], sp["every"], sp["max"]], item["speed"])
            p = level.get("powerUps")
            self.assertEqual([",".join(p["kinds"]), p["every"], p["lasts"]] if p else None, item["powerUps"])
            self.assertEqual(daily_seed(item["date"]), item["seed"])


class Runs(unittest.TestCase):
    def test_runs(self):
        for run in FIXTURES["runs"]:
            with self.subTest(run=run["name"]):
                level = level_for(run)
                self.assertEqual(layout_line(level), run["layout"])
                s = create_game(level, run["seed"])
                self.assertEqual(state_line(s), run["start"])
                hashes = [run["hashes"][i:i + 8] for i in range(0, len(run["hashes"]), 8)]
                inputs = run["inputs"].split(" ")
                line = ""
                for i, presses in enumerate(inputs):
                    for p in filter(None, presses.split(",")):
                        s = toggle_pause(s) if p == "pause" else turn(s, p)
                    s, events = tick(s)
                    line = f"{state_line(s)}#{';'.join(event_text(e) for e in events)}"
                    if f"{seed_from(line):08x}" != hashes[i]:
                        self.fail(f"move {i + 1} differs: {line}")
                self.assertEqual(line, run["last"])


if __name__ == "__main__":
    unittest.main()
