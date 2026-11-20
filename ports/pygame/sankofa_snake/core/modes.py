"""The other ways to play: the daily challenge, free play and practice. Ported from modes.ts."""

from __future__ import annotations

import datetime as dt

from .levels import LEVELS
from .rng import next_random, seed_from


def date_key(d: dt.date) -> str:
    """A date as YYYY-MM-DD. Pass the player's own local date, so the challenge changes at their midnight."""
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def day_before(date: str) -> str:
    y, m, d = (int(p) for p in date.split("-"))
    return date_key(dt.date(y, m, d) - dt.timedelta(days=1))


PACES = {
    "steady": {"start": 6, "step": 1, "every": 5, "max": 9},
    "brisk": {"start": 7, "step": 1, "every": 5, "max": 11},
    "fast": {"start": 8, "step": 1, "every": 4, "max": 12},
}


def daily_level(date: str) -> dict:
    """The daily challenge for a date: a world, its edges, a pace and maybe power-ups, the same for everyone."""
    state = [seed_from(f"sankofa-daily:{date}")]

    def pick() -> float:
        r, state[0] = next_random(state[0])
        return r

    base = LEVELS[int(pick() * len(LEVELS))]
    edges = "walls" if pick() < 0.5 else "wrap"
    names = list(PACES)
    pace = names[int(pick() * len(names))]
    power_ups = base.get("powerUps")
    if not power_ups:
        power_ups = {"kinds": ["slow", "shrink", "pass"], "every": 3, "lasts": 60} if pick() < 0.5 else None
    parts = ["solid walls" if edges == "walls" else "wrap-around edges", f"a {pace} pace"]
    if power_ups:
        parts.append("power-ups")
    if base.get("vehicles"):
        parts.append("road traffic")
    last = parts.pop()
    level = {
        **base,
        "id": f"daily-{date}",
        "challenge": f"The {base['name']}, with {', '.join(parts)} and {last}.",
        "edges": edges,
        "speed": dict(PACES[pace]),
    }
    if power_ups:
        level["powerUps"] = power_ups
    else:
        level.pop("powerUps", None)
    return level


def daily_seed(date: str) -> int:
    """The seed for the daily challenge's cowries, the same for every player on that date."""
    return seed_from(f"sankofa-daily-seed:{date}")


def next_streak(last: str | None, streak: int, today: str) -> int:
    if last == today:
        return streak
    if last == day_before(today):
        return streak + 1
    return 1


#: No cowrie count ends a free play run.
ENDLESS = 100000


def free_play_level(base: dict, edges: str) -> dict:
    return {
        **base,
        "id": f"free-{base['id']}-{edges}",
        "challenge": "Collect as many cowries as you can. The run goes on until the snake crashes.",
        "edges": edges,
        "goal": ENDLESS,
    }


def practice_level(base: dict) -> dict:
    start = max(3, base["speed"]["start"] - 3)
    return {
        **base,
        "id": f"practice-{base['id']}",
        "speed": {"start": start, "step": 0, "every": base["speed"]["every"], "max": start},
        "practice": True,
    }
