"""Draws the board with pygame, following apps/web/src/render.ts: the kente frame, each world's
ground and obstacles, roads and vehicles, currents, power-ups, the cowrie and the woven snake.
Nothing here changes the game.
"""

from __future__ import annotations

import math

import pygame
import pygame.gfxdraw

from .core import is_slow, vehicle_cells
from .paints import CANOE_PAINT, KENTE as K, TAXI_PAINT, TROTRO_PAINT, canoe_index, cell_hash, hex_color, vehicle_paints

SRCALPHA = pygame.SRCALPHA

GROUND = {
    "farm": "#2E2015",
    "park": "#143222",
    "market": "#271B2E",
    "city": "#1E1F26",
    "road": "#3A2A1C",
    "lab": "#15252B",
    "maze": "#2A2412",
    "ocean": "#0E2A3A",
    "village": "#33251A",
}


def rgba(c, a: float) -> tuple[int, int, int, int]:
    if isinstance(c, str):
        c = hex_color(c)
    return (c[0], c[1], c[2], max(0, min(255, round(a * 255))))


def blend(top, bottom, a: float) -> tuple[int, int, int]:
    """The color of `top` laid over `bottom` at opacity a, for a known background."""
    top = hex_color(top) if isinstance(top, str) else top
    bottom = hex_color(bottom) if isinstance(bottom, str) else bottom
    return tuple(round(top[i] * a + bottom[i] * (1 - a)) for i in range(3))


def rect(surf, color, x, y, w, h):
    if w <= 0 or h <= 0:
        return
    x0, y0 = round(x), round(y)
    x1, y1 = round(x + w), round(y + h)
    pygame.draw.rect(surf, color, (x0, y0, max(1, x1 - x0), max(1, y1 - y0)))


def stroke_rect(surf, color, x, y, w, h, width):
    pygame.draw.rect(surf, color, (round(x), round(y), round(w), round(h)), max(1, round(width)))


def line(surf, color, a, b, width):
    w = max(1, round(width))
    pygame.draw.line(surf, color, (round(a[0]), round(a[1])), (round(b[0]), round(b[1])), w)
    if w >= 3:
        # Round the joins a little, so thick strokes don't show gaps at corners.
        for p in (a, b):
            pygame.draw.circle(surf, color, (round(p[0]), round(p[1])), w // 2)


def polyline(surf, color, points, width):
    for a, b in zip(points, points[1:]):
        line(surf, color, a, b, width)


def circle(surf, color, cx, cy, r, fill=True, width=1):
    cx, cy, r = round(cx), round(cy), max(1, round(r))
    if fill:
        if len(color) == 4 and color[3] < 255:
            pygame.draw.circle(surf, color, (cx, cy), r)
        else:
            pygame.gfxdraw.filled_circle(surf, cx, cy, r, color)
            pygame.gfxdraw.aacircle(surf, cx, cy, r, color)
    else:
        pygame.draw.circle(surf, color, (cx, cy), r, max(1, round(width)))


def ellipse(surf, color, cx, cy, rx, ry, width=0):
    box = pygame.Rect(round(cx - rx), round(cy - ry), max(1, round(rx * 2)), max(1, round(ry * 2)))
    pygame.draw.ellipse(surf, color, box, max(0, round(width)))


def quad(p0, p1, p2, n=10):
    """Points along a quadratic curve, like quadraticCurveTo."""
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]))
    return pts


def cubic(p0, p1, p2, p3, n=12):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((
            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
        ))
    return pts


class Layout:
    def __init__(self, size: int, level: dict):
        self.size = size
        self.frame = max(6, round(size * 0.035))
        self.cell = (size - self.frame * 2) / level["width"]


# Ground marks for each world, drawn into one cell on a see-through surface.


def _detail(world, surf, s, cx, cy):
    h = cell_hash(cx, cy)
    if world == "farm":
        rect(surf, (0, 0, 0, 56), 0, s * 0.8, s, s * 0.14)
        if h % 6 == 0:
            c = (92, 170, 80, 115)
            w = max(1, s * 0.06)
            line(surf, c, (s * 0.5, s * 0.78), (s * 0.5, s * 0.5), w)
            polyline(surf, c, quad((s * 0.5, s * 0.6), (s * 0.3, s * 0.5), (s * 0.28, s * 0.42), 6), w)
            polyline(surf, c, quad((s * 0.5, s * 0.6), (s * 0.7, s * 0.5), (s * 0.72, s * 0.42), 6), w)
    elif world == "park":
        if h % 4 == 0:
            c = (120, 200, 110, 89)
            for dx in (-0.12, 0, 0.12):
                line(surf, c, (s * (0.5 + dx), s * 0.75), (s * (0.5 + dx * 1.8), s * 0.45), max(1, s * 0.05))
        elif h % 11 == 1:
            circle(surf, (242, 183, 5, 128), s * 0.5, s * 0.5, s * 0.09)
    elif world == "market":
        if (cx + cy) % 2 == 0:
            rect(surf, (255, 255, 255, 9), 0, 0, s, s)
    elif world == "city":
        stroke_rect(surf, (255, 255, 255, 13), s * 0.08, s * 0.08, s * 0.84, s * 0.84, 1)
        if h % 17 == 3:
            rect(surf, (0, 0, 0, 89), s * 0.3, s * 0.3, s * 0.4, s * 0.4)
    elif world == "road":
        if h % 7 == 2:
            circle(surf, (255, 230, 200, 31), s * 0.35, s * 0.6, s * 0.07)
            circle(surf, (255, 230, 200, 31), s * 0.62, s * 0.45, s * 0.05)
    elif world == "lab":
        c = (247, 238, 220, 15)
        if cx % 2 == 0:
            line(surf, c, (0, 0), (0, s), 1)
        if cy % 2 == 0:
            line(surf, c, (0, 0), (s, 0), 1)
    elif world == "maze":
        if h % 9 == 4:
            ellipse(surf, (242, 183, 5, 26), s * 0.4, s * 0.55, s * 0.12, s * 0.07)
    elif world == "ocean":
        if h % 5 == 1:
            pts = quad((s * 0.2, s * 0.6), (s * 0.35, s * 0.45), (s * 0.5, s * 0.6), 6)
            pts += quad((s * 0.5, s * 0.6), (s * 0.65, s * 0.45), (s * 0.8, s * 0.6), 6)[1:]
            polyline(surf, (247, 238, 220, 36), pts, max(1, s * 0.05))
    elif world == "village":
        if h % 13 == 5:
            color = rgba([K["gold"], K["green"], K["red"]][h % 3], 0.35)
            polyline(surf, color, quad((s * 0.2, s * 0.7), (s * 0.5, s * 0.3), (s * 0.8, s * 0.6), 8), max(1, s * 0.04))


def _frame(surf, size, f):
    surf.fill(K["black"])
    colors = [K["gold"], K["green"], K["gold"], K["red"], K["gold"], K["black"]]
    block = f * 1.6

    def strip(x, y, w, h, horizontal):
        length = w if horizontal else h
        i, p = 0, 0.0
        while p < length:
            ln = min(block - 1, length - p)
            if horizontal:
                rect(surf, colors[i % 6], x + p, y + 1, ln, h - 2)
            else:
                rect(surf, colors[i % 6], x + 1, y + p, w - 2, ln)
            i += 1
            p += block

    strip(0, 0, size, f, True)
    strip(0, size - f, size, f, True)
    strip(0, f, f, size - f * 2, False)
    strip(size - f, f, f, size - f * 2, False)


def _piece_box(x, y, s, cx, cy, obstacles, pad):
    sides = {
        "left": (cx - 1, cy) in obstacles,
        "right": (cx + 1, cy) in obstacles,
        "up": (cx, cy - 1) in obstacles,
        "down": (cx, cy + 1) in obstacles,
    }
    l = x + (0 if sides["left"] else pad)
    t = y + (0 if sides["up"] else pad)
    r = x + s - (0 if sides["right"] else pad)
    b = y + s - (0 if sides["down"] else pad)
    return l, t, r, b, sides


def _outer_edges(surf, color, box, width):
    l, t, r, b, sides = box
    if not sides["up"]:
        line(surf, color, (l, t), (r, t), width)
    if not sides["down"]:
        line(surf, color, (l, b), (r, b), width)
    if not sides["left"]:
        line(surf, color, (l, t), (l, b), width)
    if not sides["right"]:
        line(surf, color, (r, t), (r, b), width)


def _stall(surf, x, y, s, back_row, cx, cy, obstacles):
    pad = s * 0.04
    box = _piece_box(x, y, s, cx, cy, obstacles, pad)
    l, t, r, b, _ = box
    rect(surf, hex_color("#7A4E2D"), l, t, r - l, b - t)
    for f in (0.6, 0.8):
        line(surf, hex_color("#4A2E18"), (l, y + s * f), (r, y + s * f), max(1, s * 0.05))
    if back_row:
        for i, color in enumerate([K["gold"], K["red"], K["green"]]):
            circle(surf, color, x + s * (0.28 + i * 0.22), y + s * 0.36, s * 0.12)
            circle(surf, K["black"], x + s * (0.28 + i * 0.22), y + s * 0.36, s * 0.12, False, max(1, s * 0.035))
    else:
        stripes = [K["red"], K["gold"], K["green"], K["gold"]]
        band = (s - pad * 2) / 4
        for i, color in enumerate(stripes):
            rect(surf, color, x + pad + i * band, y + pad, band, s * 0.38)
        for i in range(4):
            cxp, cyp, rr = x + pad + band * (i + 0.5), y + pad + s * 0.38, band / 2
            pts = [(cxp + rr * math.cos(a / 8 * math.pi), cyp + rr * math.sin(a / 8 * math.pi)) for a in range(9)]
            pygame.draw.polygon(surf, K["gold"], [(round(px), round(py)) for px, py in pts])
    _outer_edges(surf, K["black"], box, max(1, s * 0.06))


def _building(surf, x, y, s, back_row, cx, cy, obstacles):
    h = cell_hash(cx, cy)
    roof = hex_color(["#3B3540", "#463A33", "#33403A"][h % 3])
    rect(surf, roof, x, y, s, s)
    stroke_rect(surf, blend((0, 0, 0), roof, 0.5), x + 0.5, y + 0.5, s - 1, s - 1, max(1, s * 0.05))
    if not back_row:
        for i, color in enumerate([K["gold"], K["green"], K["red"]]):
            rect(surf, color, x, y + s * (0.04 + i * 0.07), s, s * 0.07)
    for r in range(2):
        for c in range(2):
            lit = (h >> (r * 2 + c)) & 1
            color = blend(K["gold"], roof, 0.75) if lit else blend(K["cream"], roof, 0.12)
            rect(surf, color, x + s * (0.2 + c * 0.38), y + s * (0.2 if back_row else 0.38) + r * s * 0.3, s * 0.22, s * 0.18)


def _bench(surf, x, y, s, back_row, cx, cy, obstacles):
    pad = s * 0.04
    box = _piece_box(x, y, s, cx, cy, obstacles, pad)
    l, t, r, b, _ = box
    rect(surf, hex_color("#C9C2B4"), l, t, r - l, b - t)
    _outer_edges(surf, K["black"], box, max(1, s * 0.06))
    h = cell_hash(cx, cy)
    colors = [K["green"], K["red"], K["gold"]]
    if h % 2 == 0:
        circle(surf, colors[h % 3], x + s * 0.5, y + s * 0.56, s * 0.22)
        circle(surf, K["black"], x + s * 0.5, y + s * 0.56, s * 0.22, False, max(1, s * 0.05))
        rect(surf, K["cream"], x + s * 0.44, y + s * 0.16, s * 0.12, s * 0.2)
        stroke_rect(surf, K["black"], x + s * 0.44, y + s * 0.16, s * 0.12, s * 0.2, max(1, s * 0.05))
    else:
        for i, color in enumerate(colors):
            rect(surf, color, x + s * (0.2 + i * 0.22), y + s * 0.2, s * 0.14, s * 0.6)
            stroke_rect(surf, K["black"], x + s * (0.2 + i * 0.22), y + s * 0.2, s * 0.14, s * 0.6, max(1, s * 0.04))


def _reed_wall(surf, x, y, s, back_row, cx, cy, obstacles):
    rect(surf, hex_color("#8A6420"), x, y, s, s)
    flip = (cx + cy) % 2 == 0
    for i in range(3):
        if flip:
            rect(surf, hex_color("#C8962A"), x + s * (0.06 + i * 0.32), y + s * 0.06, s * 0.24, s * 0.88)
        else:
            rect(surf, hex_color("#C8962A"), x + s * 0.06, y + s * (0.06 + i * 0.32), s * 0.88, s * 0.24)
    stroke_rect(surf, blend((20, 16, 16), "#8A6420", 0.6), x + 0.5, y + 0.5, s - 1, s - 1, max(1, s * 0.04))


def _canoe(surf, x, y, s, back_row, cx, cy, obstacles):
    left = (cx - 1, cy) in obstacles
    right = (cx + 1, cy) in obstacles
    paint = CANOE_PAINT[canoe_index(cx, cy, obstacles) % len(CANOE_PAINT)]
    top, bottom, mid = y + s * 0.22, y + s * 0.78, y + s * 0.5
    pts = [(x if left else x + s * 0.05, top if left else mid)]
    if not left:
        pts += quad(pts[-1], (x + s * 0.2, top), (x + s * 0.5, top))[1:]
    pts.append((x + s if right else x + s * 0.5, top))
    if right:
        pts.append((x + s, bottom))
    else:
        pts += quad(pts[-1], (x + s * 0.8, top), (x + s * 0.95, mid))[1:]
        pts += quad(pts[-1], (x + s * 0.8, bottom), (x + s * 0.5, bottom))[1:]
    pts.append((x if left else x + s * 0.5, bottom))
    if not left:
        pts += quad(pts[-1], (x + s * 0.2, bottom), (x + s * 0.05, mid))[1:]
    pygame.draw.polygon(surf, paint["hull"], [(round(px), round(py)) for px, py in pts])
    w = max(1, s * 0.06)
    line(surf, K["black"], (x if left else x + s * 0.5, top), (x + s if right else x + s * 0.5, top), w)
    line(surf, K["black"], (x if left else x + s * 0.5, bottom), (x + s if right else x + s * 0.5, bottom), w)
    if not left:
        polyline(surf, K["black"], quad((x + s * 0.5, top), (x + s * 0.2, top), (x + s * 0.05, mid)), w)
        polyline(surf, K["black"], quad((x + s * 0.05, mid), (x + s * 0.2, bottom), (x + s * 0.5, bottom)), w)
    if not right:
        polyline(surf, K["black"], quad((x + s * 0.5, top), (x + s * 0.8, top), (x + s * 0.95, mid)), w)
        polyline(surf, K["black"], quad((x + s * 0.95, mid), (x + s * 0.8, bottom), (x + s * 0.5, bottom)), w)
    rect(surf, paint["band"], x + (0 if left else s * 0.3), y + s * 0.44,
         s - (0 if left else s * 0.3) - (0 if right else s * 0.3), s * 0.12)


def _loom(surf, x, y, s, back_row, cx, cy, obstacles):
    pad = s * 0.06
    rect(surf, hex_color("#5A3A1E"), x + pad, y + pad, s - pad * 2, s - pad * 2)
    colors = [K["gold"], K["green"], K["red"], K["gold"], K["black"]]
    shift = cell_hash(cx, cy) % 5
    strip = s * 0.5
    for i in range(5):
        rect(surf, colors[(i + shift) % 5], x + (s - strip) / 2, y + pad + i * ((s - pad * 2) / 5), strip, (s - pad * 2) / 5)
    for f in (0.3, 0.42, 0.58, 0.7):
        line(surf, blend(K["cream"], "#5A3A1E", 0.5), (x + s * f, y + pad), (x + s * f, y + s - pad), 1)
    stroke_rect(surf, K["black"], x + pad, y + pad, s - pad * 2, s - pad * 2, max(1, s * 0.06))


OBSTACLES = {"city": _building, "lab": _bench, "maze": _reed_wall, "ocean": _canoe, "village": _loom}


def _lane(surf, v, layout, level):
    frame, cell = layout.frame, layout.cell
    long = (level["width"] if v["axis"] == "row" else level["height"]) * cell
    across = frame + v["lane"] * cell
    tar = hex_color("#26252A")
    if v["axis"] == "row":
        rect(surf, tar, frame, across, long, cell)
    else:
        rect(surf, tar, across, frame, cell, long)
    dash, gap = cell * 0.4, cell * 0.35
    color = blend(K["cream"], tar, 0.35)
    p = 0.0
    while p < long:
        q = min(long, p + dash)
        if v["axis"] == "row":
            line(surf, color, (frame + p, across + cell / 2), (frame + q, across + cell / 2), max(1, cell * 0.06))
        else:
            line(surf, color, (across + cell / 2, frame + p), (across + cell / 2, frame + q), max(1, cell * 0.06))
        p += dash + gap


class Board:
    """Draws one run's board. The parts that never move are drawn once and kept."""

    def __init__(self):
        self._key = None
        self._back = None
        self._front = None
        self._layer = None
        self._tiles = {}

    def _scenery(self, state, layout):
        key = (id(state.level), id(state.obstacles), layout.size)
        if key == self._key:
            return
        level = state.level
        size, frame, cell = layout.size, layout.frame, layout.cell
        back = pygame.Surface((size, size))
        _frame(back, size, frame)
        rect(back, hex_color(GROUND[level["world"]]), frame, frame, size - frame * 2, size - frame * 2)
        tile = math.ceil(cell) + 1
        for cy in range(level["height"]):
            for cx in range(level["width"]):
                t = pygame.Surface((tile, tile), SRCALPHA)
                _detail(level["world"], t, cell, cx, cy)
                back.blit(t, (round(frame + cx * cell), round(frame + cy * cell)))
        grid = pygame.Surface((size, size), SRCALPHA)
        gc = (242, 183, 5, 20)
        for i in range(1, level["width"]):
            p = round(frame + i * cell)
            pygame.draw.line(grid, gc, (p, frame), (p, size - frame))
        for i in range(1, level["height"]):
            p = round(frame + i * cell)
            pygame.draw.line(grid, gc, (frame, p), (size - frame, p))
        back.blit(grid, (0, 0))
        for v in level.get("vehicles") or []:
            _lane(back, v, layout, level)
        draw_obstacle = OBSTACLES.get(level["world"], _stall)
        for cx, cy in state.obstacles:
            draw_obstacle(back, frame + cx * cell, frame + cy * cell, cell, (cx, cy - 1) in state.obstacles, cx, cy, state.obstacles)
        front = pygame.Surface((size, size), SRCALPHA)
        if level["edges"] == "walls":
            w = max(2, cell * 0.14)
            stroke_rect(front, K["red"], frame, frame, size - frame * 2, size - frame * 2, w)
        self._back, self._front = back, front
        self._layer = pygame.Surface((size, size), SRCALPHA)
        self._paints = vehicle_paints(level)
        self._key = key

    def _woven(self, s, variant, radius):
        key = (round(s * 100), variant, radius)
        if key in self._tiles:
            return self._tiles[key]
        pad = s * 0.06
        w = s - pad * 2
        size = max(2, round(w))
        tile = pygame.Surface((size, size), SRCALPHA)

        def vertical(a, b, color):
            rect(tile, color, size * a, 0, size * (b - a), size)

        def horizontal(a, b, color):
            rect(tile, color, 0, size * a, size, size * (b - a))

        def over(va, vb, ha, hb, color):
            rect(tile, color, size * va, size * ha, size * (vb - va), size * (hb - ha))

        if variant == 0:
            tile.fill(K["gold"])
            horizontal(0.2, 0.28, K["black"])
            horizontal(0.72, 0.8, K["black"])
            vertical(0.1, 0.3, K["green"])
            vertical(0.44, 0.56, K["red"])
            vertical(0.7, 0.9, K["green"])
            over(0.44, 0.56, 0.2, 0.28, K["black"])
            over(0.1, 0.3, 0.72, 0.8, K["black"])
            over(0.7, 0.9, 0.72, 0.8, K["black"])
        else:
            tile.fill(K["green"])
            vertical(0.22, 0.3, K["black"])
            vertical(0.7, 0.78, K["black"])
            horizontal(0.12, 0.32, K["gold"])
            horizontal(0.46, 0.54, K["red"])
            horizontal(0.68, 0.88, K["gold"])
            over(0.22, 0.3, 0.46, 0.54, K["black"])
            over(0.7, 0.78, 0.12, 0.32, K["black"])
            over(0.7, 0.78, 0.68, 0.88, K["black"])
        mask = pygame.Surface((size, size), SRCALPHA)
        r = round(size * radius)
        pygame.draw.rect(mask, (255, 255, 255, 255), (0, 0, size, size), border_radius=r)
        tile.blit(mask, (0, 0), special_flags=pygame.BLEND_RGBA_MIN)
        pygame.draw.rect(tile, K["black"], (0, 0, size, size), max(1, round(s * 0.07)), border_radius=r)
        self._tiles[key] = tile
        return tile

    def draw(self, surf, pos, state, size, time_ms, still=False):
        layout = Layout(size, state.level)
        self._scenery(state, layout)
        level = state.level
        frame, cell = layout.frame, layout.cell
        ox, oy = pos
        surf.blit(self._back, pos)

        layer = self._layer
        layer.fill((0, 0, 0, 0))
        for (cx, cy), d in state.currents.items():
            _current(layer, frame + cx * cell, frame + cy * cell, cell, d, 0 if still else time_ms)
        surf.blit(layer, pos)
        surf.blit(self._front, pos)

        board = surf.subsurface(pygame.Rect(ox, oy, size, size))
        if state.power_up:
            _power_up(board, state.power_up, state.moves, layout, time_ms, still)
        if state.food:
            pulse = 1 if still else 1 + 0.06 * math.sin(time_ms / 220)
            _cowrie(board, frame + state.food[0] * cell, frame + state.food[1] * cell, cell, pulse)

        for i in range(len(state.snake) - 1, -1, -1):
            cx, cy = state.snake[i]
            x, y = frame + cx * cell, frame + cy * cell
            pad = cell * 0.06
            tile = self._woven(cell, 0 if i == 0 else i % 2, 0.36 if i == 0 else 0.16)
            board.blit(tile, (round(x + pad), round(y + pad)))
            if i == 0:
                _eyes(board, x, y, cell, state.dir)
        if state.passes > 0 and state.status != "over":
            hx, hy = state.snake[0]
            _dashed_ring(board, K["green"], frame + (hx + 0.5) * cell, frame + (hy + 0.5) * cell, cell * 0.62, max(2, cell * 0.1), cell)

        for i, v in enumerate(level.get("vehicles") or []):
            _vehicle(board, v, vehicle_cells(v, level, state.vehicles[i]), layout, self._paints[i] if i < len(self._paints) else 0)

        if is_slow(state) and state.status != "over":
            layer.fill((0, 0, 0, 0))
            stroke_rect(layer, (242, 183, 5, 89), frame + cell * 0.25 - cell * 0.25, frame + cell * 0.25 - cell * 0.25,
                        size - frame * 2, size - frame * 2, cell * 0.5)
            surf.blit(layer, pos)

        if state.status == "over" and state.crash_at:
            _crash_mark(board, state.crash_at, layout)


def _eyes(surf, x, y, s, d):
    eyes = {
        "right": [(0.66, 0.3), (0.66, 0.7)],
        "left": [(0.34, 0.3), (0.34, 0.7)],
        "up": [(0.3, 0.34), (0.7, 0.34)],
        "down": [(0.3, 0.66), (0.7, 0.66)],
    }[d]
    lx, ly = {"right": (1, 0), "left": (-1, 0), "up": (0, -1), "down": (0, 1)}[d]
    for ex, ey in eyes:
        circle(surf, K["cream"], x + s * ex, y + s * ey, s * 0.13)
        circle(surf, K["black"], x + s * ex, y + s * ey, s * 0.13, False, max(1, s * 0.04))
        circle(surf, K["black"], x + s * ex + lx * s * 0.04, y + s * ey + ly * s * 0.04, s * 0.06)


def _dashed_ring(surf, color, cx, cy, r, width, cell):
    dash, gap = cell * 0.18, cell * 0.12
    circumference = 2 * math.pi * r
    p = 0.0
    while p < circumference:
        a0 = p / r
        a1 = min(circumference, p + dash) / r
        pts = [(cx + r * math.cos(a0 + (a1 - a0) * i / 4), cy + r * math.sin(a0 + (a1 - a0) * i / 4)) for i in range(5)]
        polyline(surf, color, pts, width)
        p += dash + gap


def _cowrie(surf, x, y, s, scale):
    cx, cy = x + s / 2, y + s / 2
    rx, ry = s * 0.32 * scale, s * 0.42 * scale
    brown = hex_color("#5A3A1E")
    ellipse(surf, K["cream"], cx, cy, rx, ry)
    ellipse(surf, brown, cx, cy, rx, ry, max(1, s * 0.07))
    w = max(1, s * 0.05)
    polyline(surf, brown, cubic((cx, cy - ry * 0.7), (cx - rx * 0.25, cy - ry * 0.2), (cx + rx * 0.25, cy + ry * 0.2), (cx, cy + ry * 0.7)), w)
    for i in range(-2, 3):
        ty = cy + i * ry * 0.22
        line(surf, brown, (cx - rx * 0.28, ty), (cx + rx * 0.28, ty), w)


def _current(surf, x, y, s, d, time_ms):
    rect(surf, (90, 170, 200, 71), x, y, s, s)
    dx, dy = {"right": (1, 0), "left": (-1, 0), "down": (0, 1), "up": (0, -1)}[d]
    drift = ((time_ms / 900) % 1) * 0.3 - 0.15
    cx, cy = x + s * (0.5 + dx * drift), y + s * (0.5 + dy * drift)
    a = s * 0.2
    polyline(surf, (247, 238, 220, 179), [
        (cx - dx * a - dy * a, cy - dy * a - dx * a),
        (cx + dx * a * 0.6, cy + dy * a * 0.6),
        (cx - dx * a + dy * a, cy - dy * a + dx * a),
    ], max(1.5, s * 0.09))


def _power_up(surf, p, moves, layout, time_ms, still):
    frame, cell = layout.frame, layout.cell
    if not still and p.until - moves <= 12 and math.floor(time_ms / 180) % 2 == 0:
        return
    cx, cy = frame + (p.at[0] + 0.5) * cell, frame + (p.at[1] + 0.5) * cell
    r = cell * 0.44
    circle(surf, K["cream"], cx, cy, r)
    circle(surf, K["black"], cx, cy, r, False, max(1.5, cell * 0.08))
    if p.kind == "slow":
        pts = [(cx - r * 0.45, cy - r * 0.55), (cx + r * 0.45, cy - r * 0.55), (cx - r * 0.45, cy + r * 0.55), (cx + r * 0.45, cy + r * 0.55)]
        ipts = [(round(a), round(b)) for a, b in pts]
        pygame.draw.polygon(surf, K["gold"], ipts)
        pygame.draw.polygon(surf, K["black"], ipts, max(1, round(cell * 0.06)))
    elif p.kind == "shrink":
        w = max(1.5, cell * 0.09)
        for d in (-1, 1):
            line(surf, K["red"], (cx + d * r * 0.7, cy), (cx + d * r * 0.12, cy), w)
            polyline(surf, K["red"], [(cx + d * r * 0.36, cy - r * 0.26), (cx + d * r * 0.12, cy), (cx + d * r * 0.36, cy + r * 0.26)], w)
    else:
        w = max(1.5, cell * 0.1)
        ellipse(surf, K["green"], cx - r * 0.22, cy, r * 0.3, r * 0.42, w)
        ellipse(surf, K["green"], cx + r * 0.22, cy, r * 0.3, r * 0.42, w)


def _vehicle(surf, v, cells, layout, index):
    paint = TROTRO_PAINT[index % len(TROTRO_PAINT)]
    taxi = TAXI_PAINT[index % len(TAXI_PAINT)]
    frame, cell = layout.frame, layout.cell
    runs: list[list] = []
    for c in cells:
        last = runs[-1][-1] if runs else None
        if last and abs(last[0] - c[0]) + abs(last[1] - c[1]) == 1:
            runs[-1].append(c)
        else:
            runs.append([c])
    if v["axis"] == "row":
        forward = "right" if v["dir"] == 1 else "left"
    else:
        forward = "down" if v["dir"] == 1 else "up"
    trotro = v["kind"] == "trotro"
    body = paint["body"] if trotro else taxi["body"]
    for r_i, run in enumerate(runs):
        xs = [c[0] for c in run]
        ys = [c[1] for c in run]
        x, y = frame + min(xs) * cell, frame + min(ys) * cell
        w, h = (max(xs) - min(xs) + 1) * cell, (max(ys) - min(ys) + 1) * cell
        pad = cell * 0.08
        bx, by, bw, bh = x + pad, y + pad, w - pad * 2, h - pad * 2
        wheel = cell * 0.18
        if v["axis"] == "row":
            for fx in (0.18, 0.82):
                rect(surf, K["black"], bx + bw * fx - wheel / 2, by - pad * 0.6, wheel, pad * 1.2)
                rect(surf, K["black"], bx + bw * fx - wheel / 2, by + bh - pad * 0.6, wheel, pad * 1.2)
        else:
            for fy in (0.18, 0.82):
                rect(surf, K["black"], bx - pad * 0.6, by + bh * fy - wheel / 2, pad * 1.2, wheel)
                rect(surf, K["black"], bx + bw - pad * 0.6, by + bh * fy - wheel / 2, pad * 1.2, wheel)
        box = pygame.Rect(round(bx), round(by), round(bw), round(bh))
        radius = round(cell * 0.18)
        pygame.draw.rect(surf, body, box, border_radius=radius)
        if trotro:
            for i, color in enumerate(paint["band"]):
                if v["axis"] == "row":
                    rect(surf, color, bx, by + bh * (0.62 + i * 0.08), bw, bh * 0.08)
                else:
                    rect(surf, color, bx + bw * (0.62 + i * 0.08), by, bw * 0.08, bh)
        c = cell * 0.22
        for lx, ly in ((bx, by), (bx + bw - c, by), (bx, by + bh - c), (bx + bw - c, by + bh - c)):
            rect(surf, K["red"], lx, ly, c, c)
        if r_i == 0:
            glass = (20, 16, 16, 191) if trotro else taxi["glass"]
            color = blend(glass[:3], body, glass[3] / 255)
            g = cell * 0.22
            if forward == "right":
                rect(surf, color, bx + bw - g * 1.6, by + bh * 0.18, g, bh * 0.64)
            if forward == "left":
                rect(surf, color, bx + g * 0.6, by + bh * 0.18, g, bh * 0.64)
            if forward == "down":
                rect(surf, color, bx + bw * 0.18, by + bh - g * 1.6, bw * 0.64, g)
            if forward == "up":
                rect(surf, color, bx + bw * 0.18, by + g * 0.6, bw * 0.64, g)
        outline = K["black"] if trotro else taxi["outline"]
        pygame.draw.rect(surf, outline, box, max(1, round(cell * 0.07)), border_radius=radius)


def _crash_mark(surf, at, layout):
    frame, cell, size = layout.frame, layout.cell, layout.size
    top = (size - frame * 2) / cell - 0.5
    cx = frame + (min(max(at[0], -0.5), top) + 0.5) * cell
    cy = frame + (min(max(at[1], -0.5), top) + 0.5) * cell
    r = cell * 0.45
    circle(surf, (247, 238, 220), cx, cy, r)
    circle(surf, K["black"], cx, cy, r, False, max(1.5, cell * 0.08))
    w = max(2, cell * 0.12)
    line(surf, K["red"], (cx - r * 0.5, cy - r * 0.5), (cx + r * 0.5, cy + r * 0.5), w)
    line(surf, K["red"], (cx + r * 0.5, cy - r * 0.5), (cx - r * 0.5, cy + r * 0.5), w)
