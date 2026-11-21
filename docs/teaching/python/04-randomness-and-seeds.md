# Lesson 4: Randomness and seeds (Python)

Students learn where a computer's random numbers come from, what a seed is, how the Python version does 32-bit arithmetic when Python's integers have no size limit, and how the daily challenge gives every player the same board in every version of the game.

## Start by playing

Run `python -m sankofa_snake --seed 7` twice, in two windows. The first cowrie lands in the same place in both, and on the Market the stalls stand in the same places too. Then try `--seed 8`. If you have the web game open with `?seed=7` at the end of its address, it shows the same board as the Python window.

## Computers fake randomness

A computer follows instructions exactly, so it can't pick a truly random number by itself. Instead it uses a formula that turns one number into the next, and the numbers that come out look random. This is a pseudo-random number generator. The number it starts from is the seed.

The same seed always gives the same numbers in the same order. The game depends on this:

- The tests check exact cowrie positions, so they need the same cowries on every run.
- The daily challenge needs every player to get the same board on the same day.
- A replay of a run needs the cowries to land where they did the first time.

## The generator in the game

`sankofa_snake/core/rng.py` holds a small generator called mulberry32, the same one the web game uses. Students don't need to follow every bit operation inside it. They only need its shape:

```python
def next_random(state: int) -> tuple[float, int]:
    """Returns the next random number in [0, 1) and the generator's new state."""
```

You give it the generator's state, and it gives back a number from 0 up to (but never reaching) 1, plus the state to use next time. The game keeps that state in `GameState.rng`, so it travels with the rest of the run.

`place_food` in `game.py` uses it to pick a cowrie's cell:

```python
r, rng = next_random(state.rng)
return replace(state, food=cells[int(r * len(cells))], rng=rng)
```

`cells` is the list of empty cells. Multiplying `r` by the length and cutting off the fraction with `int` picks a position in the list, and every empty cell has the same chance.

## 32-bit numbers in Python

The generator comes from JavaScript, where the bit operations work on 32-bit numbers. A 32-bit number has a fixed size, so a multiplication that grows too big loses its top bits, and the generator depends on that.

Python's integers have no size limit. `4294967295 * 4294967295` is just a very big number. So the port keeps only the low 32 bits by hand, with a mask:

```python
MASK = 0xFFFFFFFF


def imul(a: int, b: int) -> int:
    """Multiplies two 32-bit numbers and keeps the low 32 bits, like Math.imul, as an unsigned number."""
    return (a * b) & MASK
```

`0xFFFFFFFF` is 32 ones in binary, and `&` keeps only the bits that are 1 in both numbers. Without the mask, Python's numbers would grow on every call, and the Python version would give different cowries from the web game.

## Why not Python's own `random`?

Python's `random` module has a seed too. `random.seed(7)` followed by `random.random()` gives the same number every time. It uses a different generator, the Mersenne Twister, so it would give different numbers from the web game for the same seed. It also keeps its state hidden inside the module, where the game state can't carry it.

## The daily challenge

`seed_from(text)` turns any text into a seed. `daily_level(date)` in `sankofa_snake/core/modes.py` feeds it the date and then uses random numbers from that seed to pick a world, solid walls or wrap-around edges, a pace and whether power-ups appear:

```python
state = [seed_from(f"sankofa-daily:{date}")]
...
base = LEVELS[int(pick() * len(LEVELS))]
edges = "walls" if pick() < 0.5 else "wrap"
```

Everyone in the world who plays on that date runs the same steps and gets the same answer, in TypeScript, Python or R, with no server involved.

## Questions on paper

1. `int(r * len(cells))` picks a position in a list of 300 open cells. What position do you get for `r = 0`, `r = 0.5` and `r = 0.999`? Can it ever give 300?
2. Give two reasons the game keeps the generator's state inside `GameState` instead of calling `random.random()`.
3. Two friends open the daily challenge on the same date, one in Accra and one in Boise. Do they get the same challenge? Look at `date_key` in `modes.py` and where `app.py` calls it.
4. What would go wrong if the port left out `& MASK` in `imul`?

## At the keyboard

1. Call the generator three times, passing the state along each time. Run the test twice and check you get the same numbers both times:

   ```python
   def test_same_numbers_from_the_same_seed(self):
       numbers = []
       state = 1
       for _ in range(3):
           value, state = next_random(state)
           numbers.append(value)
       print(numbers)
       self.assertAlmostEqual(numbers[0], 0.6271, places=4)
   ```

2. Find out which world the daily challenge picks for your birthday this year with `daily_level("YYYY-MM-DD")["name"]`, and print its `challenge`.
3. Check that the generator is fair. Make 10,000 numbers, count how many fall in each tenth (0 to 0.1, 0.1 to 0.2 and so on), and print the ten counts. Each should be close to 1,000. `int(value * 10)` tells you which tenth a number falls in.
4. In a Python shell, work out `4294967295 * 4294967295` and then `(4294967295 * 4294967295) & 0xFFFFFFFF`. What does the second one keep?

## Notes for the teacher

1. Positions 0, 150 and 299. It can never give 300, because `r` is always less than 1, so the last position is 299, the last cell in the list.
2. Python's `random` module uses a different generator, so the cowries wouldn't match the web game or the daily challenge in the other versions. And its state lives inside the module, so two games at once, a replay or a test would all disturb each other's numbers.
3. They get the same challenge only when their dates match. `app.py` calls `date_key(dt.date.today())`, and `date.today()` reads each computer's own clock, so for a few hours each day Accra is already on the next date while Boise is not. Each date's challenge is the same for everyone who plays it.
4. The numbers would keep growing past 32 bits, so every value after the first few would differ from the web game. The reference tests would fail on the first cowrie that landed somewhere else.

At the keyboard, the first number from seed 1 is about 0.62707. In exercise 4, the second result is 1, the low 32 bits of the full product. For exercise 3, students with some statistics can go further with a chi-square test on the ten counts. With nine degrees of freedom, a value above about 16.9 would be surprising at the 5% level. A good generator should pass most of the time, and fail about one time in twenty.
