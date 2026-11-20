"""Short sounds for the game's events, made in code like the web game's Web Audio sounds.

Every world plays the same tunes from a five-note scale, each with its own instrument, using the
same notes, voices and envelopes as apps/web/src/sound.ts. The samples are worked out in a
background thread when a run starts, so the game never waits for them.
"""

from __future__ import annotations

import math
import random
import threading
from array import array

SCALE = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319]
RATE = 22050
MASTER = 0.22

# name, wave, octave, partials [ratio, loudness, share of the note it rings], attack, bend
VOICES = {
    "farm": ("sine", 1, [(1, 0.9, 1), (3.9, 0.25, 0.3)], 0.006, 1),
    "park": ("sine", 2, [(1, 0.7, 1), (2, 0.1, 0.8)], 0.04, 1),
    "market": ("sine", 1.5, [(1, 0.6, 1), (2.76, 0.3, 0.5), (5.4, 0.12, 0.25)], 0.003, 1),
    "city": ("triangle", 1, [(1, 0.8, 0.8), (2, 0.3, 0.4)], 0.004, 1),
    "road": ("square", 0.5, [(1, 0.2, 0.7), (1.01, 0.16, 0.7)], 0.01, 1),
    "lab": ("sine", 2, [(1, 0.55, 1), (2.4, 0.25, 0.6), (4.2, 0.08, 0.3)], 0.002, 1),
    "maze": ("sine", 0.5, [(1, 1, 0.8), (3.9, 0.3, 0.3)], 0.006, 1),
    "ocean": ("sine", 1, [(1, 0.8, 1)], 0.004, 1.5),
    "village": ("sine", 1, [(1, 0.8, 1), (2.76, 0.25, 0.4), (3.9, 0.2, 0.3)], 0.005, 1),
}


def cue(kind: str, eaten: int = 0) -> list[tuple]:
    """The notes for an event, as (pitch, start, length, volume). Pitch is an index into SCALE."""
    if kind == "ate":
        return [(2 + (eaten - 1) % 5, 0, 0.3, 1)]
    if kind == "speedup":
        return [(5, 0.12, 0.15, 0.6), (7, 0.2, 0.2, 0.6)]
    if kind == "powerAppeared":
        return [(9, 0, 0.25, 0.4)]
    if kind == "power":
        return [(4, 0, 0.15, 1), (6, 0.07, 0.15, 1), (8, 0.14, 0.3, 1)]
    if kind == "passed":
        return [(7, 0, 0.15, 0.7), (5, 0.08, 0.2, 0.7)]
    if kind == "crash":
        return [(3, 0.05, 0.25, 0.7), (1, 0.17, 0.25, 0.7), (0, 0.29, 0.5, 0.7)]
    if kind == "cleared":
        return [(0, 0, 0.2, 1), (2, 0.12, 0.2, 1), (4, 0.24, 0.2, 1), (5, 0.36, 0.2, 1), (7, 0.48, 0.6, 1)]
    return []


def _wave(kind: str, phase: float) -> float:
    if kind == "sine":
        return math.sin(phase)
    p = (phase / (2 * math.pi)) % 1
    if kind == "square":
        return 1.0 if p < 0.5 else -1.0
    return 4 * abs(p - 0.5) - 1  # triangle


def _ramp(a: float, b: float, t: float, length: float) -> float:
    """An exponential ramp from a to b over length seconds, like exponentialRampToValueAtTime."""
    if t >= length:
        return b
    return a * (b / a) ** (t / length)


def _render_notes(world: str, notes: list[tuple], out: list[float]) -> None:
    wave, octave, partials, attack, bend = VOICES.get(world, VOICES["farm"])
    for pitch, at, length, volume in notes:
        start = int((0.01 + at) * RATE)
        for ratio, level, share in partials:
            decay = length * share
            f0 = SCALE[max(0, min(len(SCALE) - 1, pitch))] * octave * ratio
            end_env = max(decay, attack + 0.02)
            n = int((decay + 0.05) * RATE)
            phase = 0.0
            peak = level * volume
            for i in range(n):
                t = i / RATE
                f = f0 if bend == 1 else _ramp(f0, f0 * bend, t, min(0.12, decay))
                phase += 2 * math.pi * f / RATE
                if t < attack:
                    g = _ramp(0.0001, peak, t, attack)
                else:
                    g = _ramp(peak, 0.0001, t - attack, end_env - attack)
                j = start + i
                if j >= len(out):
                    out.extend([0.0] * (j - len(out) + 1))
                out[j] += _wave(wave, phase) * g


def _swish(out: list[float]) -> None:
    """A short burst of noise through a band-pass filter that sweeps up, like water rushing past."""
    rng = random.Random(7)
    length = 0.25
    n = int(length * RATE)
    x1 = x2 = y1 = y2 = 0.0
    q = 1.2
    start = int(0.01 * RATE)
    if len(out) < start + n:
        out.extend([0.0] * (start + n - len(out)))
    for i in range(n):
        t = i / RATE
        f = _ramp(500, 1800, t, length)
        w = 2 * math.pi * f / RATE
        alpha = math.sin(w) / (2 * q)
        b0, b2 = alpha, -alpha
        a0, a1, a2 = 1 + alpha, -2 * math.cos(w), 1 - alpha
        x = rng.random() * 2 - 1
        y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x, y1, y
        g = _ramp(0.0001, 0.35, t, 0.05) if t < 0.05 else _ramp(0.35, 0.0001, t - 0.05, length - 0.05)
        out[start + i] += y * g


def _thud(out: list[float], volume: float) -> None:
    """A low drum hit for a crash or a bump."""
    n = int(0.35 * RATE)
    start = int(0.01 * RATE)
    if len(out) < start + n:
        out.extend([0.0] * (start + n - len(out)))
    phase = 0.0
    for i in range(n):
        t = i / RATE
        f = _ramp(150, 55, t, 0.25)
        phase += 2 * math.pi * f / RATE
        g = _ramp(0.0001, volume * 4, t, 0.01) if t < 0.01 else _ramp(volume * 4, 0.0001, t - 0.01, 0.29)
        out[start + i] += _wave("triangle", phase) * g


def render(world: str, kind: str, eaten: int = 0) -> list[float]:
    """All the samples for one event in one world, before the master volume."""
    out: list[float] = []
    _render_notes(world, cue(kind, eaten), out)
    if kind == "current":
        _swish(out)
    if kind == "crash":
        _thud(out, 0.22)
    if kind == "bump":
        _thud(out, 0.12)
    return out


#: The events that make a sound, with a key for each sound. "ate" has five, one per note.
SOUNDS = [("ate", e) for e in range(1, 6)] + [
    (k, 0) for k in ("speedup", "powerAppeared", "power", "passed", "crash", "cleared", "current", "bump")
]


class Sound:
    """Plays the event sounds with pygame.mixer. Without a sound device, it stays quiet."""

    def __init__(self, sound_on: bool):
        self.sound_on = sound_on
        self.world = "farm"
        self._cache: dict = {}
        self._lock = threading.Lock()
        self._ready = False
        self._channels = 1
        try:
            import pygame

            if not pygame.mixer.get_init():
                pygame.mixer.init(RATE, -16, 1, 512)
            freq, _size, channels = pygame.mixer.get_init()
            self._rate = freq
            self._channels = channels
            self._pygame = pygame
            self._ready = True
        except Exception:
            self._ready = False

    def prepare(self, world: str) -> None:
        """Works out one world's sounds in the background, so they are ready when the snake first eats."""
        self.world = world
        if not self._ready:
            return

        def work():
            for kind, eaten in SOUNDS:
                key = (world, kind, eaten)
                with self._lock:
                    if key in self._cache:
                        continue
                try:
                    snd = self._make(render(world, kind, eaten))
                except Exception:
                    # The mixer closed, such as when the game quits. The sound is simply skipped.
                    return
                with self._lock:
                    self._cache[key] = snd

        threading.Thread(target=work, daemon=True).start()

    def _make(self, samples: list[float]):
        step = RATE / self._rate
        n = int(len(samples) / step)
        data = array("h")
        for i in range(n):
            v = samples[int(i * step)] * MASTER
            v = max(-1.0, min(1.0, v))
            s = int(v * 32767)
            for _ in range(self._channels):
                data.append(s)
        return self._pygame.mixer.Sound(buffer=data.tobytes())

    def play(self, event: dict, eaten: int = 0) -> None:
        if not self.sound_on or not self._ready:
            return
        kind = event["type"]
        key = (self.world, kind, 1 + (eaten - 1) % 5 if kind == "ate" else 0)
        with self._lock:
            snd = self._cache.get(key)
        if snd is not None:
            try:
                snd.play()
            except Exception:
                pass
