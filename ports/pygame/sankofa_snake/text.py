"""Every piece of text the game shows, in one place. The words match apps/web/src/text.ts.

The level names and challenges come from the level files. A translation copies this file.
"""

from __future__ import annotations


def plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


NAME = "Sankofa Snake"
LEAD = (
    "Steer a snake of woven kente blocks around the board and collect cowrie shells. "
    "Each level adds a new world and one new rule."
)
SANKOFA_NOTE = 'Sankofa is an Akan word from Ghana. It means "go back and get it."'

BUTTONS = {
    "play": "Play",
    "daily": "Daily challenge",
    "choose_level": "Choose a level",
    "how_to_play": "How to play",
    "back": "Back",
    "pause": "Pause",
    "resume": "Resume",
    "sound": "Sound",
    "play_again": "Play again",
    "practice_again": "Practice again",
    "next_level": "Next level",
    "play_daily": "Play today's challenge",
    "reset": "Reset progress",
    "confirm_reset": "Delete my progress",
    "cancel": "Cancel",
    "to_title": "Back to the title",
}

HELP = {
    "heading": "How to play",
    "items": [
        "Steer with the arrow keys or W, A, S and D. You can also click the arrow buttons beside the board, "
        "or drag across the board in the direction you want the snake to go.",
        "Eat 20 cowrie shells to clear a level and open the next one. The snake grows longer with each shell.",
        "The run ends if the snake runs into its own tail, an obstacle or a vehicle. Vehicles stop for the snake, "
        "so cross the road in front of them or behind them. From the City on, the edge of the board is a wall too.",
        "In the Ocean and the Weaving village, currents push the snake one square the way their arrows point when "
        "it swims across them. Swimming along a current, the way its arrows point, makes the snake faster until "
        "it leaves the current.",
        "In the Lab, the Maze and the Weaving village, power-ups appear on the board for a short time. The gold "
        "hourglass is slow motion, the red arrows shrink the snake, and the green loop lets the snake pass through "
        "its own tail once.",
        "Pause with Space, P or Escape. The game also pauses when you switch to another window.",
        "Clearing a level earns one star. A high score and a fast finish earn up to two more.",
        "The daily challenge picks a world and its rules from the date, so everyone gets the same challenge on the "
        "same date. The date comes from your own computer, so a new challenge starts at your midnight. Clear it on "
        "days in a row to build a streak.",
        "Free play is the classic game in any world you have opened, with wrap-around edges or walls. It goes on "
        "until the snake crashes.",
        "Practice opens every level at a slower speed. Running into something only stops the snake, so it suits a "
        "class demo.",
        "Press M to turn the sound off or on.",
    ],
    "settings": "Settings",
    "gold_means_on": "Gold means on.",
    "progress": "Your progress",
    "progress_note": "Scores, stars, cleared levels, the daily streak and free play bests stay on this computer.",
    "confirm": (
        "This deletes your scores, stars, cleared levels, daily streak and free play bests on this computer. "
        "Your sound switch stays as it is. You can't undo this."
    ),
    "reset_done": "Progress deleted.",
}

LEVELS = {
    "heading": {"levels": "Levels", "free": "Free play", "practice": "Practice"},
    "wrap": "Wrap-around edges",
    "walls": "Walls",
    "intro": {
        "levels": "Clear a level to open the next one.",
        "free": "Play the classic game in any world you have opened, until the snake crashes.",
        "practice": "Every level, at a slower speed. Running into something only stops the snake.",
    },
}


def card(n: int) -> str:
    return f"Level {n}"


def locked(previous: str) -> str:
    return f"Clear the {previous} to open this level"


PRACTICE_STATUS = "Slower, and the run never ends"


def free_best(n: int) -> str:
    return f"Best {n} cowries"


def best(n: int) -> str:
    return f"Best {n}"


NOT_PLAYED = "Not played yet"

DAILY = {
    "heading": "Daily challenge",
    "world": "Today's world",
    "cleared_today": "Cleared today",
    "not_cleared": "Not cleared yet today",
}


def daily_lead(date: str) -> str:
    return f"{date}. Everyone gets the same challenge on the same date. A new one starts at midnight on your computer."


def daily_goal(challenge: str, goal: int) -> str:
    return f"{challenge} Eat {goal} cowries to clear it."


def todays_best(n: int) -> str:
    return f"Today's best {n}"


def streak(now: int, longest: int) -> str:
    return f"Streak: {plural(now, 'day', 'days')}. Longest: {plural(longest, 'day', 'days')}."


HUD = {"cowries": "Cowries", "score": "Score", "best": "Best"}
HINT = "Arrow keys or W, A, S and D to steer. Space to pause and M for sound."


def hud_eaten(eaten: int, goal: int | None) -> str:
    return str(eaten) if goal is None else f"{eaten} of {goal}"


def hud_slow(moves: int) -> str:
    return f"Slow motion for {moves} more moves"


def hud_passes(n: int) -> str:
    return "One pass through the tail" if n == 1 else f"{n} passes through the tail"


RUN = {
    "start": "Press an arrow key to start.",
    "bump_title": "Bump",
    "bump_go": "Choose a new direction to keep going.",
    "paused": "Paused",
    "over": "Game over",
    "practice_done": "Practice run complete",
    "cleared": "Level cleared",
    "daily_cleared": "Daily challenge cleared",
    "all_cleared": "You've cleared all nine levels.",
}


def run_level(n: int, name: str) -> str:
    return f"Level {n}: {name}"


def run_daily(name: str) -> str:
    return f"Daily challenge: {name}"


def run_free(name: str) -> str:
    return f"Free play: {name}"


def run_practice(name: str) -> str:
    return f"Practice: {name}"


def free_tally(eaten: int, best_: int) -> str:
    return f"You collected {plural(eaten, 'cowrie', 'cowries')}. Your best here is {best_}."


def tally(eaten: int, goal: int, score: int) -> str:
    return f"You collected {eaten} of {goal} cowries. Score {score}."


def practice_tally(goal: int, score: int) -> str:
    return f"You collected all {goal} cowries. Score {score}."


def stars_label(n: int) -> str:
    return f"{n} of 3 stars"


def bonus(score: int, b: int) -> str:
    return f"Score {score}, including a time bonus of {b}."


def daily_streak(n: int) -> str:
    return f"Your streak is {plural(n, 'day', 'days')}. Come back tomorrow for a new challenge."


def best_stars(n: int) -> str:
    return f"Your best on this level is {n} stars."


OBSTACLE = {
    "market": "a market stall",
    "city": "a building",
    "lab": "a lab bench",
    "maze": "a wall of the maze",
    "ocean": "a canoe",
    "village": "a loom",
}

CANT_SAVE = "This computer isn't letting the game save. Your progress lasts only until you close the game."


def hit_name(state, cause) -> str:
    if cause == "wall":
        return "the wall"
    if cause == "obstacle":
        return OBSTACLE.get(state.level["world"], "an obstacle")
    if cause == "vehicle":
        return f"a {state.crash_vehicle or 'car'}"
    return "its own tail"


def crash_text(state) -> str:
    what = hit_name(state, state.crash)
    if state.crash_pushed:
        return f"A current pushed the snake into {what}."
    return "The snake hit the wall." if state.crash == "wall" else f"The snake ran into {what}."


def bump_text(state) -> str:
    return f"The snake bumped into {hit_name(state, state.bump)}."


def long_date(d) -> str:
    """Today's date, such as "Friday 20 November"."""
    return f"{d:%A} {d.day} {d:%B}"


def star_text(n: int) -> str:
    return "★" * n + "☆" * (3 - n)
