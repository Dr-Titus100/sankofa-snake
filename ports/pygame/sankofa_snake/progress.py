"""Saves best scores, stars, cleared levels, the daily streak and free play bests in a file.

The file holds the same JSON the web game keeps in the browser, and every value is checked when
it loads, the same way, so a damaged or edited file never breaks the game. Nothing leaves the computer.
"""

from __future__ import annotations

import copy
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

from .core import LEVELS, day_before, next_streak

SAVE_VERSION = 2
LIMITS = {"score": 1_000_000, "cowries": 10_000, "streak": 100_000}
LEVEL_IDS = {level["id"] for level in LEVELS}
FREE_KEY = re.compile(r"^([a-z]+)-(wrap|walls)$")


def save_path() -> Path:
    """Where progress lives: SANKOFA_SNAKE_HOME if set, or the usual place for app data on this system."""
    env = os.environ.get("SANKOFA_SNAKE_HOME")
    if env:
        return Path(env) / "progress.json"
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home()))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "sankofa-snake" / "progress.json"


def _count(v, top: int) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= top


def is_date(v) -> bool:
    if not isinstance(v, str) or not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        return False
    try:
        dt.date(*(int(p) for p in v.split("-")))
        return True
    except ValueError:
        return False


def clean_progress(raw) -> dict:
    """Keeps the good values of a saved object and drops the rest. Never raises."""
    progress: dict = {"levels": {}}
    if not isinstance(raw, dict):
        return progress
    levels = raw.get("levels")
    if isinstance(levels, dict):
        for level_id, value in levels.items():
            if level_id not in LEVEL_IDS or not isinstance(value, dict):
                continue
            progress["levels"][level_id] = {
                "best": value["best"] if _count(value.get("best"), LIMITS["score"]) else 0,
                "stars": value["stars"] if _count(value.get("stars"), 3) else 0,
                "cleared": value.get("cleared") is True,
            }
    d = raw.get("daily")
    if isinstance(d, dict) and is_date(d.get("date")):
        streak = d["streak"] if _count(d.get("streak"), LIMITS["streak"]) else 0
        last = d.get("lastCleared") if is_date(d.get("lastCleared")) else None
        best_streak = d["bestStreak"] if _count(d.get("bestStreak"), LIMITS["streak"]) else 0
        progress["daily"] = {
            "date": d["date"],
            "best": d["best"] if _count(d.get("best"), LIMITS["score"]) else 0,
            "cleared": d.get("cleared") is True,
            "streak": streak if last else 0,
            "bestStreak": max(best_streak, streak if last else 0),
        }
        if last:
            progress["daily"]["lastCleared"] = last
    free = raw.get("free")
    if isinstance(free, dict):
        kept = {}
        for k, v in free.items():
            m = FREE_KEY.match(k) if isinstance(k, str) else None
            if m and m.group(1) in LEVEL_IDS and _count(v, LIMITS["cowries"]):
                kept[k] = v
        if kept:
            progress["free"] = kept
    s = raw.get("settings")
    if isinstance(s, dict):
        progress["settings"] = {"sound": s.get("sound") is not False, "vibration": s.get("vibration") is not False}
    return progress


def settings_of(progress: dict) -> dict:
    return {"sound": True, "vibration": True, **(progress.get("settings") or {})}


def load_progress(path: Path | None = None) -> dict:
    try:
        return clean_progress(json.loads((path or save_path()).read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return {"levels": {}}


def save_progress(progress: dict, path: Path | None = None) -> bool:
    """Saves progress. Returns False when the computer won't keep it."""
    path = path or save_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"version": SAVE_VERSION, **progress}), encoding="utf-8")
        os.replace(tmp, path)
        return True
    except OSError:
        return False


def reset_progress(progress: dict) -> dict:
    """Deletes scores, stars, cleared levels, the daily streak and free play bests. Keeps the switches."""
    return {"levels": {}, "settings": progress["settings"]} if progress.get("settings") else {"levels": {}}


def record_run(progress: dict, level_id: str, score: int, stars: int, cleared: bool) -> dict:
    old = progress["levels"].get(level_id, {"best": 0, "stars": 0, "cleared": False})
    out = copy.deepcopy(progress)
    out["levels"][level_id] = {
        "best": max(old["best"], score),
        "stars": max(old["stars"], stars),
        "cleared": old["cleared"] or cleared,
    }
    return out


def record_daily(progress: dict, date: str, score: int, cleared: bool) -> dict:
    old = progress.get("daily")
    same_day = bool(old) and old["date"] == date
    daily = {
        "date": date,
        "best": max(old["best"] if same_day else 0, score),
        "cleared": (same_day and old["cleared"]) or cleared,
        "streak": old["streak"] if old else 0,
        "bestStreak": old["bestStreak"] if old else 0,
    }
    if old and old.get("lastCleared"):
        daily["lastCleared"] = old["lastCleared"]
    if cleared:
        daily["streak"] = next_streak(old.get("lastCleared") if old else None, old["streak"] if old else 0, date)
        daily["lastCleared"] = date
        daily["bestStreak"] = max(daily["bestStreak"], daily["streak"])
    out = copy.deepcopy(progress)
    out["daily"] = daily
    return out


def current_streak(progress: dict, today: str) -> int:
    d = progress.get("daily")
    if not d or not d.get("lastCleared"):
        return 0
    return d["streak"] if d["lastCleared"] in (today, day_before(today)) else 0


def record_free(progress: dict, key: str, eaten: int) -> dict:
    out = copy.deepcopy(progress)
    free = out.setdefault("free", {})
    free[key] = max(free.get(key, 0), eaten)
    return out
