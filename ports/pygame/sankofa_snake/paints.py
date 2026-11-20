"""Vehicle and canoe paint, ported from apps/web/src/render.ts. Kept apart from the drawing so it can be tested without a screen."""

from __future__ import annotations

KENTE = {
    "gold": (0xF2, 0xB7, 0x05),
    "green": (0x1E, 0x8A, 0x3E),
    "red": (0xC8, 0x10, 0x2E),
    "black": (0x14, 0x10, 0x10),
    "cream": (0xF7, 0xEE, 0xDC),
}


def hex_color(text: str) -> tuple[int, int, int]:
    text = text.lstrip("#")
    return (int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16))


K = KENTE

#: Trotro paint: a body color and the kente band down its side. No body is red, so the red corner lights show.
TROTRO_PAINT = [
    {"body": hex_color("#F7EEDC"), "band": [K["green"], K["red"], K["green"]]},
    {"body": hex_color("#2E8B57"), "band": [K["gold"], K["red"], K["gold"]]},
    {"body": hex_color("#3D7CC9"), "band": [K["gold"], K["green"], K["gold"]]},
    {"body": hex_color("#B8BCC2"), "band": [K["green"], K["red"], K["green"]]},
]

#: Taxi paint: the body, the outline and the windscreen (with its opacity).
TAXI_PAINT = [
    {"body": K["gold"], "outline": K["black"], "glass": (20, 16, 16, 191)},
    {"body": K["black"], "outline": K["cream"], "glass": (247, 238, 220, 153)},
    {"body": hex_color("#E8742A"), "outline": K["black"], "glass": (20, 16, 16, 191)},
    {"body": hex_color("#7B4FA0"), "outline": K["black"], "glass": (20, 16, 16, 191)},
    {"body": hex_color("#1E9E9A"), "outline": K["black"], "glass": (20, 16, 16, 191)},
]

CANOE_PAINT = [
    {"hull": hex_color("#8A5A32"), "band": K["gold"]},
    {"hull": hex_color("#2F6FA8"), "band": K["gold"]},
    {"hull": hex_color("#C8372D"), "band": K["gold"]},
    {"hull": hex_color("#2E8B57"), "band": K["red"]},
    {"hull": hex_color("#E9DFC8"), "band": K["red"]},
]

M32 = 0xFFFFFFFF


def vehicle_paints(level: dict) -> list[int]:
    """Which paint each vehicle gets. The colors are shuffled from where the roads are, as in the web game."""
    vehicles = level.get("vehicles") or []
    h = 2166136261
    for v in vehicles:
        for n in (1 if v["axis"] == "row" else 2, v["lane"], v["start"], v["dir"], v["length"]):
            h = ((h ^ (n & 0xFF)) * 16777619) & M32

    def nxt() -> float:
        nonlocal h
        h ^= (h << 13) & M32
        h ^= h >> 17
        h ^= (h << 5) & M32
        return h / 4294967296

    def order(size: int) -> list[int]:
        items = list(range(size))
        for i in range(size - 1, 0, -1):
            j = int(nxt() * (i + 1))
            items[i], items[j] = items[j], items[i]
        return items

    picks = {"trotro": order(len(TROTRO_PAINT)), "taxi": order(len(TAXI_PAINT))}
    count = {"trotro": 0, "taxi": 0}
    out = []
    for v in vehicles:
        kind = v["kind"]
        out.append(picks[kind][count[kind] % len(picks[kind])])
        count[kind] += 1
    return out


def cell_hash(x: int, y: int) -> int:
    """A fixed pseudo-random number for a cell, so scenery stays in place from frame to frame."""
    h = (x * 374761393 + y * 668265263) & M32
    h = ((h ^ (h >> 13)) * 1274126177) & M32
    return (h ^ (h >> 16)) & M32


def canoe_index(cx: int, cy: int, obstacles) -> int:
    """A canoe's place among all the canoes on the board, counted from the top left."""
    start = cx
    while (start - 1, cy) in obstacles:
        start -= 1
    starts = sorted(((x, y) for x, y in obstacles if (x - 1, y) not in obstacles), key=lambda c: (c[1], c[0]))
    try:
        return starts.index((start, cy))
    except ValueError:
        return 0
