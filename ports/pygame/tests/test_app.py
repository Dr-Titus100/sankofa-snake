"""Checks the Pygame game without a screen: its screens, its controls, saving and the sounds."""

import os
import sys
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pygame  # noqa: E402

from sankofa_snake import app  # noqa: E402
from sankofa_snake.core import LEVELS  # noqa: E402
from sankofa_snake.progress import clean_progress, load_progress, record_daily, current_streak  # noqa: E402
from sankofa_snake.sound import SOUNDS, render  # noqa: E402


class AppTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pygame.init()
        cls.surf = pygame.display.set_mode((app.WIDTH, app.HEIGHT))

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / "progress.json"
        self.game = app.Game(seed=2024, save_path=self.path)

    def tearDown(self):
        self.dir.cleanup()

    def draw(self):
        self.game.draw(self.surf, 1000)

    def press(self, label):
        self.draw()
        button = next(b for b in self.game.buttons if b.label == label)
        self.game.on_press(button.rect.center, False)
        self.draw()

    def key(self, key, mod=0):
        self.game.handle(pygame.event.Event(pygame.KEYDOWN, key=key, mod=mod, unicode=""))

    def test_every_screen_draws(self):
        for name in ("title", "levels", "daily", "help"):
            self.game.show(name)
            self.draw()
        for mode in ("levels", "free", "practice"):
            self.game.set_list_mode(mode)
            self.draw()

    def test_play_starts_the_first_level_and_the_snake_waits(self):
        self.press("Play")
        g = self.game
        self.assertEqual(g.screen_name, "game")
        self.assertEqual(g.state.level["id"], "farm")
        self.assertEqual(g.state.status, "ready")
        g.update(1000)
        self.assertEqual(g.state.moves, 0)

    def test_keys_steer_and_pause(self):
        self.press("Play")
        g = self.game
        self.key(pygame.K_d)
        self.assertEqual(g.state.status, "running")
        g.update(200)
        self.assertEqual(g.state.moves, 1)
        self.key(pygame.K_SPACE)
        self.assertEqual(g.state.status, "paused")
        g.update(1000)
        self.assertEqual(g.state.moves, 1)
        self.key(pygame.K_p)
        self.assertEqual(g.state.status, "running")

    def test_arrow_pad_turns_on_press(self):
        self.press("Play")
        self.press("up")
        self.assertEqual(self.game.state.status, "running")
        self.assertEqual(self.game.state.queue, ("up",))

    def test_a_drag_across_the_board_steers(self):
        self.press("Play")
        g = self.game
        x, y = g.board_rect().center
        g.on_press((x, y), False)
        g.on_move((x, y - 40))
        g.on_release((x, y - 40), False)
        self.assertEqual(g.state.queue, ("up",))

    def test_a_finger_tap_pauses_and_a_mouse_click_does_not(self):
        self.press("Play")
        g = self.game
        self.key(pygame.K_d)
        x, y = g.board_rect().center
        g.on_press((x, y), False)
        g.on_release((x, y), False)
        self.assertEqual(g.state.status, "running")
        g.on_press((x, y), True)
        g.on_release((x, y), True)
        self.assertEqual(g.state.status, "paused")

    def test_losing_focus_pauses(self):
        self.press("Play")
        self.key(pygame.K_d)
        self.game.handle(pygame.event.Event(pygame.WINDOWFOCUSLOST))
        self.assertEqual(self.game.state.status, "paused")

    def test_a_crash_saves_the_score_and_play_again_starts_over(self):
        g = self.game
        # The City has walls, so heading straight up always ends the run.
        g.start_run("levels", 3)
        self.draw()
        self.key(pygame.K_w)
        for _ in range(100):
            if g.state.status != "running":
                break
            g.update(200)
        self.assertEqual(g.state.status, "over")
        self.assertIn("city", load_progress(self.path)["levels"])
        self.press("Play again")
        self.assertEqual(g.state.status, "ready")

    def test_sound_switch_is_saved_and_reset_keeps_it(self):
        self.game.show("help")
        self.press("Sound")
        self.assertFalse(load_progress(self.path)["settings"]["sound"])
        self.game.progress["levels"]["farm"] = {"best": 300, "stars": 2, "cleared": True}
        self.press("Reset progress")
        self.press("Delete my progress")
        saved = load_progress(self.path)
        self.assertEqual(saved["levels"], {})
        self.assertFalse(saved["settings"]["sound"])

    def test_locked_levels_open_in_practice(self):
        self.game.show("levels")
        self.draw()
        cards = [b for b in self.game.buttons if b.kind == "card"]
        self.assertEqual([c.disabled for c in cards], [False] + [True] * 8)
        self.game.set_list_mode("practice")
        self.draw()
        cards = [b for b in self.game.buttons if b.kind == "card"]
        self.assertFalse(any(c.disabled for c in cards))
        self.game.on_press(cards[8].rect.center, False)
        self.assertTrue(self.game.state.level.get("practice"))
        self.assertEqual(self.game.state.level["world"], "village")

    def test_daily_challenge_uses_the_date(self):
        g = app.Game(save_path=self.path)
        g.start_run("daily", 0)
        self.assertTrue(g.state.level["id"].startswith("daily-"))
        self.assertEqual(LEVELS[g.level_index]["world"], g.state.level["world"])

    def test_the_window_opens_and_closes(self):
        game = app.run(frames=3, save_path=self.path)
        self.assertEqual(game.screen_name, "title")


class ProgressTest(unittest.TestCase):
    def test_damaged_saves_are_cleaned(self):
        raw = {"levels": {"farm": {"best": -5, "stars": 9, "cleared": "yes"}, "nope": {}}, "daily": {"date": "2026-02-30"},
               "free": {"farm-wrap": 7, "farm-sideways": 3}, "settings": {"sound": False}}
        self.assertEqual(clean_progress(raw), {
            "levels": {"farm": {"best": 0, "stars": 0, "cleared": False}},
            "free": {"farm-wrap": 7},
            "settings": {"sound": False, "vibration": True},
        })
        self.assertEqual(clean_progress("junk"), {"levels": {}})

    def test_streaks(self):
        p = {"levels": {}}
        p = record_daily(p, "2026-11-19", 300, True)
        p = record_daily(p, "2026-11-20", 200, True)
        self.assertEqual(current_streak(p, "2026-11-20"), 2)
        self.assertEqual(current_streak(p, "2026-11-22"), 0)


class SoundTest(unittest.TestCase):
    def test_every_world_has_every_sound(self):
        for world in ("farm", "park", "market", "city", "road", "lab", "maze", "ocean", "village"):
            for kind, eaten in SOUNDS:
                samples = render(world, kind, eaten)
                self.assertTrue(samples and max(abs(s) for s in samples) > 0.01, f"{world} {kind}")


if __name__ == "__main__":
    unittest.main()
