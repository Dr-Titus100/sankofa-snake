"""The Pygame version of Sankofa Snake: the title screen, the level list, the daily challenge,
How to play, the board and the messages over it. The rules come from sankofa_snake.core, which
plays exactly like packages/core in the web game. The words come from text.py.
"""

from __future__ import annotations

import datetime as dt
import math
import random
from pathlib import Path

import pygame

from . import text as T
from .core import (
    LEVELS,
    create_game,
    daily_level,
    daily_seed,
    date_key,
    free_play_level,
    is_slow,
    layout_seed,
    move_ms,
    new_layout,
    pause,
    practice_level,
    tick,
    toggle_pause,
    turn,
)
from .paints import KENTE as K
from .progress import (
    clean_progress,
    current_streak,
    load_progress,
    record_daily,
    record_free,
    record_run,
    reset_progress,
    save_progress,
    settings_of,
)
from .render import Board
from .sound import Sound

WIDTH, HEIGHT = 960, 760
PAGE = (15, 11, 12)
PANEL = (29, 21, 23)
CARD = (38, 28, 31)
MUTED = (217, 205, 184)
GOLD, GREEN, RED, BLACK, CREAM = K["gold"], K["green"], K["red"], K["black"], K["cream"]
ASSETS = Path(__file__).resolve().parent / "assets"

KEYS = {
    pygame.K_UP: "up", pygame.K_DOWN: "down", pygame.K_LEFT: "left", pygame.K_RIGHT: "right",
    pygame.K_w: "up", pygame.K_s: "down", pygame.K_a: "left", pygame.K_d: "right",
}
SWIPE = 24
BOARD_SIZE = 640
BOARD_POS = (20, 64)


class Button:
    def __init__(self, rect, label, action, kind="normal", pressed=None, disabled=False, focusable=True):
        self.rect = pygame.Rect(rect)
        self.label = label
        self.action = action
        self.kind = kind  # normal, primary, danger, tab, toggle, card, pad
        self.pressed = pressed
        self.disabled = disabled
        self.focusable = focusable and not disabled


def wrap(font, words: str, width: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in words.split(" "):
        test = f"{line} {word}".strip()
        if font.size(test)[0] <= width or not line:
            line = test
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def star_points(cx, cy, r):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


class Game:
    def __init__(self, seed: int | None = None, fixed: bool = False, save_path: Path | None = None):
        self.seed = seed
        self.fixed = fixed
        self.save_path = save_path
        self.progress = load_progress(save_path)
        self.saving = True
        self.sound = Sound(settings_of(self.progress)["sound"])
        self.screen_name = "title"
        self.list_mode = "levels"
        self.free_edges = "wrap"
        self.mode = "levels"
        self.level_index = 0
        self.daily_date = ""
        self.state = None
        self.last_clear = None
        self.confirm = False
        self.reset_done = False
        self.focus = 0
        self.scroll = 0
        self.content_height = HEIGHT
        self.buttons: list[Button] = []
        self.board = Board()
        self.carry = 0.0
        self.swipe = None
        self.pad_down = None
        self.focus_first_card = False
        self.confirm_focus = False
        self.running = True
        self.fonts = {}
        self.logo = None

    # Setup

    def font(self, size, bold=False):
        key = (size, bold)
        if key not in self.fonts:
            self.fonts[key] = pygame.font.SysFont("dejavusans,freesans,liberationsans,arial,helvetica", size, bold=bold)
        return self.fonts[key]

    def load_logo(self, size):
        path = ASSETS / "sankofa-logo.svg"
        try:
            if hasattr(pygame.image, "load_sized_svg"):
                return pygame.image.load_sized_svg(str(path), (size, size))
            return pygame.transform.smoothscale(pygame.image.load(str(path)), (size, size))
        except Exception:
            return None

    # Progress

    def save(self):
        self.progress = clean_progress(self.progress)
        if not save_progress(self.progress, self.save_path):
            self.saving = False

    def toggle_sound(self):
        settings = settings_of(self.progress)
        settings["sound"] = not settings["sound"]
        self.progress = {**self.progress, "settings": settings}
        self.save()
        self.sound.sound_on = settings["sound"]

    def is_unlocked(self, i):
        return i == 0 or bool(self.progress["levels"].get(LEVELS[i - 1]["id"], {}).get("cleared"))

    def next_level_index(self):
        for i in range(len(LEVELS)):
            if not self.is_unlocked(i):
                return max(0, i - 1)
            if not self.progress["levels"].get(LEVELS[i]["id"], {}).get("cleared"):
                return i
        return len(LEVELS) - 1

    def free_key(self, level=None):
        level = level or LEVELS[self.level_index]
        return f"{level['id']}-{self.free_edges}"

    # Screens

    def show(self, name):
        self.screen_name = name
        self.focus = 0
        self.scroll = 0
        # The level list opens with the first open level in focus, as the web game does.
        self.focus_first_card = name == "levels"
        if name != "help":
            self.confirm = False
            self.reset_done = False

    def back(self):
        """Goes back one step: a running game pauses first, then each press goes back one screen."""
        if self.screen_name == "help" and self.confirm:
            self.confirm = False
            return
        if self.screen_name == "game":
            if self.state and self.state.status == "running":
                self.apply(pause(self.state))
            else:
                self.leave_run()
            return
        if self.screen_name == "title":
            self.running = False
            return
        self.show("title")

    def leave_run(self):
        self.show("daily" if self.mode == "daily" else "levels")

    # Playing

    def start_run(self, mode, i):
        self.mode = mode
        if mode != "daily":
            self.list_mode = mode
        seed = self.seed if self.seed is not None else random.getrandbits(32)
        if mode == "daily":
            self.daily_date = date_key(dt.date.today())
            level = daily_level(self.daily_date)
            seed = self.seed if self.seed is not None else daily_seed(self.daily_date)
            i = next(n for n, lv in enumerate(LEVELS) if lv["world"] == level["world"])
        elif mode == "free":
            level = free_play_level(LEVELS[i], self.free_edges)
        elif mode == "practice":
            level = practice_level(LEVELS[i])
        else:
            level = LEVELS[i]
        if not self.fixed:
            level = new_layout(level, layout_seed(seed))
        self.level_index = i
        self.state = create_game(level, seed)
        self.sound.prepare(level["world"])
        self.carry = 0.0
        self.last_clear = None
        self.show("game")

    def run_title(self):
        level = LEVELS[self.level_index]
        if self.mode == "daily":
            return T.run_daily(self.state.level["name"])
        if self.mode == "free":
            return T.run_free(level["name"])
        if self.mode == "practice":
            return T.run_practice(level["name"])
        return T.run_level(level["number"], level["name"])

    def command_turn(self, d):
        if self.state and self.screen_name == "game":
            self.apply(turn(self.state, d))

    def command_pause(self):
        if self.state and self.screen_name == "game":
            self.apply(toggle_pause(self.state))

    def apply(self, nxt, events=()):
        before = self.state.status
        self.state = nxt
        for e in events:
            self.on_event(e)
        if nxt.status != before:
            self.focus = 0
            if nxt.status == "running":
                self.carry = 0.0

    def on_event(self, e):
        level = self.state.level
        self.sound.play(e, self.state.eaten)
        if e["type"] == "crash":
            if self.mode == "levels":
                self.progress = record_run(self.progress, level["id"], self.state.score, 0, False)
            if self.mode == "daily":
                self.progress = record_daily(self.progress, self.daily_date, self.state.score, False)
            if self.mode == "free":
                self.progress = record_free(self.progress, self.free_key(), self.state.eaten)
            self.save()
        if e["type"] == "cleared":
            self.last_clear = e
            if self.mode == "levels":
                self.progress = record_run(self.progress, level["id"], e["score"], e["stars"], True)
            if self.mode == "daily":
                self.progress = record_daily(self.progress, self.daily_date, e["score"], True)
            self.save()

    def update(self, dt_ms):
        if self.screen_name != "game" or not self.state or self.state.status != "running":
            return
        self.carry += min(dt_ms, 250)
        n = 0
        while n < 4 and self.carry >= move_ms(self.state) and self.state.status == "running":
            self.carry -= move_ms(self.state)
            nxt, events = tick(self.state)
            self.apply(nxt, events)
            n += 1

    # Input

    def activate(self, button):
        if button.disabled:
            return
        button.action()

    def handle(self, event):
        if event.type == pygame.QUIT:
            self.running = False
        elif event.type in (pygame.WINDOWFOCUSLOST, pygame.WINDOWMINIMIZED):
            if self.screen_name == "game" and self.state:
                self.apply(pause(self.state))
        elif event.type == pygame.KEYDOWN:
            self.on_key(event)
        elif event.type == pygame.MOUSEWHEEL:
            self.scroll_by(-event.y * 40)
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            self.on_press(event.pos, getattr(event, "touch", False))
        elif event.type == pygame.MOUSEMOTION:
            self.on_move(event.pos)
        elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            self.on_release(event.pos, getattr(event, "touch", False))

    def focusables(self):
        return [b for b in self.buttons if b.focusable]

    def on_key(self, e):
        key = e.key
        mods = e.mod & (pygame.KMOD_CTRL | pygame.KMOD_ALT | pygame.KMOD_META)
        fs = self.focusables()
        if key == pygame.K_TAB:
            if fs:
                step = -1 if e.mod & pygame.KMOD_SHIFT else 1
                self.focus = (self.focus + step) % len(fs)
                self.reveal(fs[self.focus])
            return
        if self.screen_name == "game":
            if key == pygame.K_m and not mods:
                self.toggle_sound()
                return
            if key in KEYS and not mods:
                self.command_turn(KEYS[key])
                return
            if key in (pygame.K_SPACE, pygame.K_p, pygame.K_ESCAPE) and not mods:
                self.command_pause()
                return
            # Enter presses the focused button on the message over the board, such as Play again.
            if key in (pygame.K_RETURN, pygame.K_KP_ENTER) and fs:
                self.activate(fs[min(self.focus, len(fs) - 1)])
            return
        if key == pygame.K_ESCAPE or key == pygame.K_BACKSPACE:
            self.back()
            return
        if key in (pygame.K_DOWN, pygame.K_RIGHT) and fs:
            self.focus = (self.focus + 1) % len(fs)
            self.reveal(fs[self.focus])
        elif key in (pygame.K_UP, pygame.K_LEFT) and fs:
            self.focus = (self.focus - 1) % len(fs)
            self.reveal(fs[self.focus])
        elif key in (pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_SPACE) and fs:
            self.activate(fs[min(self.focus, len(fs) - 1)])
        elif key in (pygame.K_PAGEDOWN,):
            self.scroll_by(300)
        elif key in (pygame.K_PAGEUP,):
            self.scroll_by(-300)

    def reveal(self, button):
        if button.rect.bottom > HEIGHT - 10:
            self.scroll_by(button.rect.bottom - HEIGHT + 30)
        elif button.rect.top < 10:
            self.scroll_by(button.rect.top - 30)

    def scroll_by(self, dy):
        if self.screen_name == "game":
            return
        self.scroll = max(0, min(max(0, self.content_height - HEIGHT), self.scroll + dy))

    def board_rect(self):
        return pygame.Rect(BOARD_POS[0], BOARD_POS[1], BOARD_SIZE, BOARD_SIZE)

    def on_press(self, pos, touch):
        for i, b in enumerate(self.buttons):
            if b.rect.collidepoint(pos) and not b.disabled:
                if b.focusable:
                    self.focus = self.focusables().index(b)
                if b.kind == "pad":
                    # The snake turns as soon as the arrow is pressed, without waiting for the release.
                    self.pad_down = b
                    b.action()
                else:
                    self.activate(b)
                return
        if self.screen_name == "game" and self.board_rect().collidepoint(pos):
            self.swipe = {"start": pos, "moved": False}

    def on_move(self, pos):
        if not self.swipe:
            return
        sx, sy = self.swipe["start"]
        d = swipe_direction(pos[0] - sx, pos[1] - sy)
        if d:
            self.command_turn(d)
            self.swipe = {"start": pos, "moved": True}

    def on_release(self, pos, touch):
        self.pad_down = None
        if not self.swipe:
            return
        if not self.swipe["moved"]:
            sx, sy = self.swipe["start"]
            d = swipe_direction(pos[0] - sx, pos[1] - sy)
            if d:
                self.command_turn(d)
            elif touch:
                # A tap with a finger pauses, the way it does on a phone. A mouse click never does.
                self.command_pause()
        self.swipe = None

    # Drawing helpers

    def text(self, surf, words, size, color, pos, bold=False, center=False, width=None, line_gap=1.35):
        font = self.font(size, bold)
        lines = wrap(font, words, width) if width else [words]
        x, y = pos
        h = round(size * line_gap)
        for ln in lines:
            img = font.render(ln, True, color)
            if center:
                surf.blit(img, (x - img.get_width() // 2, y))
            else:
                surf.blit(img, (x, y))
            y += h
        return y

    def draw_button(self, surf, b, focused):
        r = b.rect
        hover = r.collidepoint(pygame.mouse.get_pos()) and not b.disabled
        font = self.font(17, True)
        if b.kind == "card":
            return
        if b.kind == "pad":
            active = self.pad_down is b
            bg = GOLD if active else (44, 36, 38)
            pygame.draw.rect(surf, bg, r, border_radius=12)
            pygame.draw.rect(surf, GOLD if active or focused else CREAM, r, 2, border_radius=12)
            cx, cy = r.center
            s = r.width * 0.28
            arrow = {
                "up": [(cx, cy - s), (cx + s, cy + s * 0.7), (cx - s, cy + s * 0.7)],
                "down": [(cx, cy + s), (cx - s, cy - s * 0.7), (cx + s, cy - s * 0.7)],
                "left": [(cx - s, cy), (cx + s * 0.7, cy - s), (cx + s * 0.7, cy + s)],
                "right": [(cx + s, cy), (cx - s * 0.7, cy + s), (cx - s * 0.7, cy - s)],
            }[b.label]
            pygame.draw.polygon(surf, BLACK if active else CREAM, arrow)
            return
        on = b.kind == "primary" or (b.kind in ("tab", "toggle") and b.pressed)
        if b.kind == "danger":
            bg, fg, border = RED, CREAM, RED
        elif on or (hover and b.kind != "toggle"):
            bg, fg, border = GOLD, BLACK, GOLD
        else:
            bg, fg, border = None, CREAM, CREAM
        if b.disabled:
            bg, fg, border = None, (120, 112, 104), (90, 84, 80)
        radius = r.height // 2 if b.kind in ("tab", "toggle") else 10
        if bg:
            pygame.draw.rect(surf, bg, r, border_radius=radius)
        pygame.draw.rect(surf, border, r, 2, border_radius=radius)
        if focused:
            pygame.draw.rect(surf, CREAM, r.inflate(8, 8), 2, border_radius=radius + 4)
        img = font.render(b.label, True, fg)
        surf.blit(img, (r.centerx - img.get_width() // 2, r.centery - img.get_height() // 2))

    def stars(self, surf, n, x, y, r=9, color=GOLD):
        for i in range(3):
            pts = star_points(x + i * (r * 2.4) + r, y + r, r)
            if i < n:
                pygame.draw.polygon(surf, color, pts)
            else:
                pygame.draw.polygon(surf, color, pts, 2)

    # Screens

    def draw(self, surf, now_ms):
        surf.fill(PAGE)
        panel = pygame.Rect(8, 8, WIDTH - 16, HEIGHT - 16)
        pygame.draw.rect(surf, PANEL, panel, border_radius=18)
        stripe = [GOLD, GREEN, GOLD, RED]
        for i, c in enumerate(stripe):
            pygame.draw.rect(surf, c, (panel.x + 18 + i * (panel.width - 36) // 4, panel.y, (panel.width - 36) // 4, 6))
        self.buttons = []
        # Screens that scroll stay inside the panel, below its kente stripe.
        surf.set_clip(pygame.Rect(panel.x, panel.y + 8, panel.width, panel.height - 12))
        getattr(self, f"draw_{self.screen_name}")(surf, now_ms)
        surf.set_clip(None)
        fs = self.focusables()
        if fs:
            self.focus = min(self.focus, len(fs) - 1)
        for b in self.buttons:
            self.draw_button(surf, b, bool(fs) and b.focusable and fs[self.focus] is b)

    def add(self, *args, **kw):
        b = Button(*args, **kw)
        self.buttons.append(b)
        return b

    def save_warning(self, surf, y):
        if self.saving:
            return y
        return self.text(surf, T.CANT_SAVE, 16, (255, 200, 120), (WIDTH // 2, y), center=True, width=640) + 6

    def draw_title(self, surf, now):
        if self.logo is None:
            self.logo = self.load_logo(150) or False
        y = 40
        if self.logo:
            surf.blit(self.logo, (WIDTH // 2 - 75, y))
        y += 160
        y = self.text(surf, T.NAME, 36, GOLD, (WIDTH // 2, y), bold=True, center=True) + 6
        y = self.text(surf, T.LEAD, 19, CREAM, (WIDTH // 2, y), center=True, width=620) + 18
        b = T.BUTTONS
        for label, action, kind in (
            (b["play"], lambda: self.start_run("levels", self.next_level_index()), "primary"),
            (b["daily"], lambda: self.show("daily"), "normal"),
            (b["choose_level"], self.open_levels, "normal"),
            (b["how_to_play"], lambda: self.show("help"), "normal"),
        ):
            self.add((WIDTH // 2 - 140, y, 280, 46), label, action, kind)
            y += 56
        y = self.save_warning(surf, y + 8)
        self.text(surf, T.SANKOFA_NOTE, 16, MUTED, (WIDTH // 2, y + 10), center=True, width=640)

    def open_levels(self):
        self.list_mode = "levels"
        self.show("levels")

    def set_list_mode(self, mode):
        self.list_mode = mode
        self.scroll = 0
        self.focus = ["levels", "free", "practice"].index(mode)

    def set_edges(self, edges):
        self.free_edges = edges

    def draw_levels(self, surf, now):
        mode = self.list_mode
        top = -self.scroll
        y = top + 26
        y = self.text(surf, T.LEVELS["heading"][mode], 30, GOLD, (WIDTH // 2, y), bold=True, center=True) + 8
        labels = [("levels", T.LEVELS["heading"]["levels"]), ("free", T.LEVELS["heading"]["free"]), ("practice", T.LEVELS["heading"]["practice"])]
        x = WIDTH // 2 - (3 * 150 + 2 * 10) // 2
        for m, label in labels:
            self.add((x, y, 150, 38), label, lambda m=m: self.set_list_mode(m), "tab", pressed=(m == mode))
            x += 160
        y += 48
        if mode == "free":
            x = WIDTH // 2 - (220 * 2 + 10) // 2
            for e, label in (("wrap", T.LEVELS["wrap"]), ("walls", T.LEVELS["walls"])):
                self.add((x, y, 220, 34), label, lambda e=e: self.set_edges(e), "tab", pressed=(e == self.free_edges))
                x += 230
            y += 44
        y = self.text(surf, T.LEVELS["intro"][mode], 17, MUTED, (WIDTH // 2, y), center=True) + 8
        cw, ch, gap = 290, 164 if mode != "free" else 104, 12
        x0 = WIDTH // 2 - (cw * 3 + gap * 2) // 2
        for i, level in enumerate(LEVELS):
            cx = x0 + (i % 3) * (cw + gap)
            cy = y + (i // 3) * (ch + gap)
            open_ = mode == "practice" or self.is_unlocked(i)
            r = pygame.Rect(cx, cy, cw, ch)
            b = self.add(r, level["name"], lambda i=i: self.start_run(mode, i), "card", disabled=not open_)
            fs_focus = self.focusables()
            focused = b.focusable and fs_focus and len(fs_focus) - 1 == self.focus
            hover = r.collidepoint(pygame.mouse.get_pos()) and open_
            pygame.draw.rect(surf, CARD, r, border_radius=14)
            self.card_stripe(surf, r)
            pygame.draw.rect(surf, GOLD if hover or focused else (70, 58, 60), r, 2, border_radius=14)
            alpha_color = CREAM if open_ else (130, 120, 110)
            ty = cy + 10
            ty = self.text(surf, T.card(level["number"]), 14, MUTED if open_ else (110, 100, 95), (cx + 20, ty))
            ty = self.text(surf, level["name"], 21, GOLD if open_ else (130, 110, 60), (cx + 20, ty), bold=True)
            if mode != "free":
                ty = self.text(surf, level["challenge"], 14, alpha_color, (cx + 20, ty + 2), width=cw - 34, line_gap=1.22)
            sy = cy + ch - 28
            p = self.progress["levels"].get(level["id"])
            if not open_:
                self.text(surf, T.locked(LEVELS[i - 1]["name"]), 14, (150, 140, 130), (cx + 20, sy))
            elif mode == "practice":
                self.text(surf, T.PRACTICE_STATUS, 14, MUTED, (cx + 20, sy))
            elif mode == "free":
                self.text(surf, T.free_best(self.progress.get("free", {}).get(self.free_key(level), 0)), 14, MUTED, (cx + 20, sy))
            elif p:
                self.stars(surf, p["stars"], cx + 20, sy, 8)
                self.text(surf, T.best(p["best"]), 14, MUTED, (cx + 90, sy))
            else:
                self.text(surf, T.NOT_PLAYED, 14, MUTED, (cx + 20, sy))
        y += 3 * (ch + gap) + 6
        self.add((WIDTH // 2 - 90, y, 180, 44), T.BUTTONS["back"], lambda: self.show("title"))
        self.content_height = y + 70 + self.scroll
        if self.focus_first_card:
            fs = self.focusables()
            cards = [b for b in fs if b.kind == "card"]
            if cards:
                self.focus = fs.index(cards[0])
            self.focus_first_card = False

    def card_stripe(self, surf, r):
        """The kente stripe down the left edge of a card, rounded at the card's corners."""
        parts = ((GOLD, 0, 0.3), (GREEN, 0.3, 0.55), (RED, 0.55, 0.7), (GOLD, 0.7, 1))
        for j, (c, a, b) in enumerate(parts):
            top = r.y + round(r.height * a)
            rect = pygame.Rect(r.x, top, 8, r.y + round(r.height * b) - top)
            pygame.draw.rect(surf, c, rect, border_top_left_radius=14 if j == 0 else 0,
                             border_bottom_left_radius=14 if j == len(parts) - 1 else 0)

    def draw_daily(self, surf, now):
        today_d = dt.date.today()
        today = date_key(today_d)
        level = daily_level(today)
        d = self.progress.get("daily") if (self.progress.get("daily") or {}).get("date") == today else None
        y = 40
        y = self.text(surf, T.DAILY["heading"], 32, GOLD, (WIDTH // 2, y), bold=True, center=True) + 8
        y = self.text(surf, T.daily_lead(T.long_date(today_d)), 18, CREAM, (WIDTH // 2, y), center=True, width=640) + 16
        r = pygame.Rect(WIDTH // 2 - 280, y, 560, 190)
        pygame.draw.rect(surf, CARD, r, border_radius=14)
        self.card_stripe(surf, r)
        pygame.draw.rect(surf, (70, 58, 60), r, 2, border_radius=14)
        ty = self.text(surf, T.DAILY["world"], 15, MUTED, (r.x + 24, r.y + 14))
        ty = self.text(surf, level["name"], 24, GOLD, (r.x + 24, ty), bold=True)
        ty = self.text(surf, T.daily_goal(level["challenge"], level["goal"]), 17, CREAM, (r.x + 24, ty + 4), width=r.width - 44)
        status = T.DAILY["cleared_today"] if d and d.get("cleared") else T.DAILY["not_cleared"]
        self.text(surf, f"{status}    {T.todays_best(d['best'] if d else 0)}", 15, MUTED, (r.x + 24, r.bottom - 32))
        y = r.bottom + 18
        longest = (self.progress.get("daily") or {}).get("bestStreak", 0)
        y = self.text(surf, T.streak(current_streak(self.progress, today), longest), 19, CREAM, (WIDTH // 2, y), center=True) + 18
        self.add((WIDTH // 2 - 160, y, 320, 46), T.BUTTONS["play_daily"], lambda: self.start_run("daily", 0), "primary")
        self.add((WIDTH // 2 - 90, y + 58, 180, 44), T.BUTTONS["back"], lambda: self.show("title"))
        self.content_height = HEIGHT

    def ask_reset(self):
        self.confirm = True
        self.reset_done = False
        self.focus = 0

    def cancel_reset(self):
        self.confirm = False

    def do_reset(self):
        self.progress = reset_progress(self.progress)
        self.save()
        self.confirm = False
        self.reset_done = True

    def draw_help(self, surf, now):
        y = 26 - self.scroll
        y = self.text(surf, T.HELP["heading"], 30, GOLD, (WIDTH // 2, y), bold=True, center=True) + 10
        font = self.font(16)
        for item in T.HELP["items"]:
            lines = wrap(font, item, 820)
            pygame.draw.circle(surf, GOLD, (WIDTH // 2 - 430, y + 10), 4)
            for ln in lines:
                surf.blit(font.render(ln, True, CREAM), (WIDTH // 2 - 418, y))
                y += 21
            y += 6
        y += 8
        y = self.text(surf, T.HELP["settings"], 21, GOLD, (WIDTH // 2, y), bold=True, center=True) + 6
        self.add((WIDTH // 2 - 70, y, 140, 38), T.BUTTONS["sound"], self.toggle_sound, "toggle", pressed=settings_of(self.progress)["sound"])
        y += 46
        y = self.text(surf, T.HELP["gold_means_on"], 15, MUTED, (WIDTH // 2, y), center=True) + 10
        y = self.text(surf, T.HELP["progress"], 21, GOLD, (WIDTH // 2, y), bold=True, center=True) + 4
        y = self.text(surf, T.HELP["progress_note"], 15, MUTED, (WIDTH // 2, y), center=True, width=700) + 8
        y = self.save_warning(surf, y)
        if self.confirm:
            box = pygame.Rect(WIDTH // 2 - 330, y, 660, 120)
            pygame.draw.rect(surf, (38, 20, 24), box, border_radius=12)
            pygame.draw.rect(surf, RED, box, 2, border_radius=12)
            ty = self.text(surf, T.HELP["confirm"], 15, CREAM, (WIDTH // 2, y + 10), center=True, width=620)
            self.add((WIDTH // 2 - 200, ty + 6, 200, 40), T.BUTTONS["confirm_reset"], self.do_reset, "danger")
            self.add((WIDTH // 2 + 12, ty + 6, 160, 40), T.BUTTONS["cancel"], self.cancel_reset)
            # Cancel takes the focus, so a stray Enter keeps the progress.
            if not self.confirm_focus:
                self.focus = len(self.focusables()) - 1
                self.confirm_focus = True
                self.scroll_by(self.buttons[-1].rect.bottom + 80 - HEIGHT)
            y = box.bottom + 10
        else:
            self.confirm_focus = False
            self.add((WIDTH // 2 - 100, y, 200, 42), T.BUTTONS["reset"], self.ask_reset)
            y += 52
        if self.reset_done:
            y = self.text(surf, T.HELP["reset_done"], 16, GOLD, (WIDTH // 2, y), center=True) + 6
        self.add((WIDTH // 2 - 90, y + 6, 180, 44), T.BUTTONS["back"], lambda: self.show("title"))
        self.content_height = y + 70 + self.scroll

    def draw_game(self, surf, now):
        s = self.state
        x0, y0 = BOARD_POS
        self.text(surf, self.run_title(), 24, GOLD, (x0, 24), bold=True)
        self.board.draw(surf, BOARD_POS, s, BOARD_SIZE, now, still=False)

        # The score and the buttons beside the board.
        px = x0 + BOARD_SIZE + 26
        pw = WIDTH - px - 28
        y = y0
        best = 0
        if self.mode == "levels":
            best = self.progress["levels"].get(s.level["id"], {}).get("best", 0)
        if self.mode == "daily":
            dd = self.progress.get("daily") or {}
            best = dd.get("best", 0) if dd.get("date") == self.daily_date else 0
        if self.mode == "free":
            best = self.progress.get("free", {}).get(self.free_key(), 0)
        stats = [
            (T.HUD["cowries"], T.hud_eaten(s.eaten, None if self.mode == "free" else s.level["goal"])),
            (T.HUD["score"], str(s.score)),
        ]
        if self.mode != "practice":
            stats.append((T.HUD["best"], str(max(best, s.eaten if self.mode == "free" else s.score))))
        for label, value in stats:
            self.text(surf, label, 15, MUTED, (px, y))
            self.text(surf, value, 24, CREAM, (px, y + 18), bold=True)
            y += 58
        if s.level.get("powerUps"):
            power = ". ".join(p for p in (
                T.hud_slow(s.slow_until - s.moves) if is_slow(s) else "",
                T.hud_passes(s.passes) if s.passes > 0 else "",
            ) if p)
            y = self.text(surf, power, 15, GOLD, (px, y), width=pw) if power else y
            y = max(y, y0 + 58 * len(stats) + 42)
        y += 6
        b = T.BUTTONS
        self.add((px, y, pw, 42), b["resume"] if s.status == "paused" else b["pause"], self.command_pause,
                 disabled=s.status not in ("running", "paused"), focusable=False)
        self.add((px, y + 52, pw, 42), b["sound"], self.toggle_sound, "toggle", pressed=settings_of(self.progress)["sound"], focusable=False)
        self.add((px, y + 104, pw, 42), b["back"], self.leave_run, focusable=False)
        # The arrow pad, for a mouse or a touch screen.
        size = 62
        cx = px + pw // 2
        py = y + 170
        for d, (dx, dy) in (("up", (0, 0)), ("left", (-1, 1)), ("right", (1, 1)), ("down", (0, 2))):
            self.add((cx - size // 2 + dx * (size + 6), py + dy * (size + 6), size, size), d, lambda d=d: self.command_turn(d), "pad", focusable=False)
        self.text(surf, T.HINT, 14, MUTED, (x0, y0 + BOARD_SIZE + 10))
        self.draw_overlay(surf)

    def draw_overlay(self, surf):
        s = self.state
        mode = self.mode
        r = T.RUN
        b = T.BUTTONS
        has_next = mode == "levels" and self.level_index < len(LEVELS) - 1
        lines: list[tuple[str, int, tuple, bool]] = []
        buttons: list[tuple] = []
        stars = None
        passive = False
        if s.status == "ready" and s.bump:
            lines = [(r["bump_title"], 20, GOLD, True), (f"{T.bump_text(s)} {r['bump_go']}", 15, CREAM, False)]
            passive = True
        elif s.status == "ready":
            lines = [(self.run_title(), 20, GOLD, True), (s.level["challenge"], 15, CREAM, False), (r["start"], 15, CREAM, True)]
            passive = True
        elif s.status == "paused":
            lines = [(r["paused"], 24, GOLD, True)]
            buttons = [(b["resume"], self.command_pause, "primary"), (b["back"], self.leave_run, "normal")]
        elif s.status == "over":
            best = self.progress.get("free", {}).get(self.free_key(), 0) if mode == "free" else 0
            tally = T.free_tally(s.eaten, best) if mode == "free" else T.tally(s.eaten, s.level["goal"], s.score)
            lines = [(r["over"], 24, GOLD, True), (T.crash_text(s), 17, CREAM, False), (tally, 17, CREAM, False)]
            buttons = [(b["play_again"], lambda: self.start_run(mode, self.level_index), "primary"), (b["back"], self.leave_run, "normal")]
        elif s.status == "cleared" and mode == "practice":
            lines = [(r["practice_done"], 24, GOLD, True), (T.practice_tally(s.level["goal"], s.score), 17, CREAM, False)]
            buttons = [(b["practice_again"], lambda: self.start_run(mode, self.level_index), "primary"), (b["back"], self.leave_run, "normal")]
        elif s.status == "cleared" and self.last_clear:
            st, bonus = self.last_clear["stars"], self.last_clear["timeBonus"]
            lines = [(r["daily_cleared"] if mode == "daily" else r["cleared"], 24, GOLD, True)]
            stars = st
            lines.append((T.bonus(s.score, bonus), 17, CREAM, False))
            if mode == "daily":
                lines.append((T.daily_streak(current_streak(self.progress, self.daily_date)), 16, CREAM, False))
            else:
                best_st = self.progress["levels"].get(s.level["id"], {}).get("stars", st)
                if best_st > st:
                    lines.append((T.best_stars(best_st), 16, CREAM, False))
                if not has_next:
                    lines.append((r["all_cleared"], 16, CREAM, False))
            if has_next:
                buttons.append((b["next_level"], lambda: self.start_run("levels", self.level_index + 1), "primary"))
            buttons.append((b["play_again"], lambda: self.start_run(mode, self.level_index), "normal" if has_next else "primary"))
            buttons.append((b["back"], self.leave_run, "normal"))
        if not lines:
            return
        board = self.board_rect()
        width = 440
        font_lines = []
        for words, size, color, bold in lines:
            font = self.font(size, bold)
            for ln in wrap(font, words, width - 40):
                font_lines.append((ln, font, color, round(size * 1.35)))
        height = 28 + sum(h for *_, h in font_lines) + (34 if stars is not None else 0) + len(buttons) * 52
        panel = pygame.Rect(0, 0, width, height)
        if passive:
            panel.midbottom = (board.centerx, board.bottom - round(board.height * 0.08))
        else:
            panel.center = board.center
        layer = pygame.Surface(panel.size, pygame.SRCALPHA)
        pygame.draw.rect(layer, (20, 16, 16, 204 if passive else 230), layer.get_rect(), border_radius=16)
        pygame.draw.rect(layer, GOLD, layer.get_rect(), 2, border_radius=16)
        surf.blit(layer, panel.topleft)
        y = panel.y + 14
        for i, (ln, font, color, h) in enumerate(font_lines):
            img = font.render(ln, True, color)
            surf.blit(img, (panel.centerx - img.get_width() // 2, y))
            y += h
            if i == 0 and stars is not None:
                self.stars(surf, stars, panel.centerx - 40, y + 2, 13)
                y += 34
        y += 6
        for label, action, kind in buttons:
            self.add((panel.centerx - 110, y, 220, 42), label, action, kind)
            y += 52


def swipe_direction(dx, dy):
    if max(abs(dx), abs(dy)) < SWIPE:
        return None
    if abs(dx) > abs(dy):
        return "right" if dx > 0 else "left"
    return "down" if dy > 0 else "up"


def run(seed: int | None = None, fixed: bool = False, frames: int | None = None, save_path: Path | None = None):
    """Opens the window and plays until it closes. `frames` stops after that many frames, for tests."""
    pygame.mixer.pre_init(22050, -16, 1, 512)
    pygame.init()
    pygame.display.set_caption(T.NAME)
    try:
        icon = pygame.image.load(str(ASSETS / "sankofa-logo.svg"))
        pygame.display.set_icon(pygame.transform.smoothscale(icon, (64, 64)))
    except Exception:
        pass
    try:
        # SCALED lets the player resize the window and keeps the game sharp on high-density screens.
        surf = pygame.display.set_mode((WIDTH, HEIGHT), pygame.SCALED | pygame.RESIZABLE)
    except pygame.error:
        surf = pygame.display.set_mode((WIDTH, HEIGHT))
    game = Game(seed=seed, fixed=fixed, save_path=save_path)
    clock = pygame.time.Clock()
    n = 0
    while game.running:
        dt_ms = clock.tick(60)
        for event in pygame.event.get():
            game.handle(event)
        game.update(dt_ms)
        game.draw(surf, pygame.time.get_ticks())
        pygame.display.flip()
        n += 1
        if frames is not None and n >= frames:
            break
    pygame.quit()
    return game
