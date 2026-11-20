"""A small seeded random number generator (mulberry32), the same one the web game uses.

The same seed always gives the same numbers in the same order, in TypeScript, Python and R.
That is what gives every player the same daily challenge in all three games.
"""

MASK = 0xFFFFFFFF


def imul(a: int, b: int) -> int:
    """Multiplies two 32-bit numbers and keeps the low 32 bits, like Math.imul, as an unsigned number."""
    return (a * b) & MASK


def next_random(state: int) -> tuple[float, int]:
    """Returns the next random number in [0, 1) and the generator's new state."""
    s = (state + 0x6D2B79F5) & MASK
    t = s
    t = imul(t ^ (t >> 15), t | 1)
    t ^= (t + imul(t ^ (t >> 7), t | 61)) & MASK
    value = (t ^ (t >> 14)) / 4294967296
    return value, s


def seed_from(text: str) -> int:
    """Turns any text, such as a date, into a seed (32-bit FNV-1a over the character codes)."""
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = imul(h, 16777619)
    return h


class Rand:
    """A stream of random numbers from one seed, for code that draws many in a row."""

    def __init__(self, seed: int):
        self.state = seed & MASK

    def __call__(self) -> float:
        value, self.state = next_random(self.state)
        return value

    def below(self, n: int) -> int:
        return int(self() * n)
