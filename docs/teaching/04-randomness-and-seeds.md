# Lesson 4: Randomness and seeds

Students learn where a computer's random numbers come from, what a seed is, and how the daily challenge gives every player the same board.

## Start by playing

Open the game twice, in two tabs, with `?seed=7` at the end of the address. The first cowrie lands in the same place in both, and on the Market the stalls stand in the same places too. Then try `?seed=8`.

## Computers fake randomness

A computer follows instructions exactly, so it can't pick a truly random number by itself. Instead it uses a formula that turns one number into the next, and the numbers that come out look random. This is a pseudo-random number generator. The number it starts from is the seed.

The same seed always gives the same numbers in the same order. That sounds like a weakness, but the game depends on it:

- The tests check exact cowrie positions, so they need the same cowries on every run.
- The daily challenge needs every player to get the same board on the same day.
- A replay of a run needs the cowries to land where they did the first time.

## The generator in the game

`packages/core/src/rng.ts` holds a small generator called mulberry32. Students don't need to follow the bit operations inside it. They only need its shape:

```ts
nextRandom(state) // returns [value, newState]
```

You give it the generator's state, and it gives back a number from 0 up to (but never reaching) 1, plus the state to use next time. The game keeps that state in `GameState.rng`, so it travels with the rest of the run.

`placeFood` in `game.ts` uses it to pick a cowrie's cell:

```ts
const [r, rng] = nextRandom(state.rng);
return { ...state, food: open[Math.floor(r * open.length)], rng };
```

`open` is the list of empty cells. Multiplying `r` by the length and rounding down picks a position in the list, and every empty cell has the same chance.

## The daily challenge

`seedFrom(text)` turns any text into a seed. The daily challenge feeds it the date, so `"2026-11-19"` always gives the same seed. `dailyLevel(date)` in `packages/core/src/modes.ts` then uses random numbers from that seed to pick a world, solid walls or wrap-around edges, a pace and whether power-ups appear. Everyone in the world who plays on that date runs the same steps and gets the same answer, with no server involved.

## Questions on paper

1. `Math.floor(r * open.length)` picks a position in a list of 300 open cells. What position do you get for `r = 0`, `r = 0.5` and `r = 0.999`? Can it ever give 300?
2. Why does the game keep the generator's state inside `GameState` instead of calling `Math.random()`?
3. Two friends open the daily challenge on the same date, one in Accra and one in Boise. Do they get the same challenge? Look at `dateKey` in `modes.ts`, which uses the player's own clock.

## At the keyboard

1. Call the generator three times, passing the state along each time. Run the test twice and check you get the same numbers both times:

   ```ts
   import { expect, it } from "vitest";
   import { nextRandom } from "../src";

   it("gives the same numbers from the same seed", () => {
     const numbers: number[] = [];
     let state = 1;
     for (let i = 0; i < 3; i++) {
       const [value, next] = nextRandom(state);
       numbers.push(value);
       state = next;
     }
     console.log(numbers);
     expect(numbers[0]).toBeCloseTo(0.6271, 4);
   });
   ```

2. Find out which world the daily challenge picks for your birthday this year with `dailyLevel("YYYY-MM-DD").name`.
3. Check that the generator is fair. Make 10,000 numbers, count how many fall in each tenth (0 to 0.1, 0.1 to 0.2 and so on), and print the ten counts. Each should be close to 1,000.

## Notes for the teacher

1. Positions 0, 150 and 299. It can never give 300, because `r` is always less than 1, so the last position is 299, the last cell in the list.
2. You can't give `Math.random()` a seed, so the tests couldn't predict the cowries and every player would get a different daily board.
3. They get the same challenge only when their dates match. The date comes from each player's own clock, so for a few hours each day Accra is already on the next date while Boise is not. Each date's challenge is the same for everyone who plays it.

For exercise 3, students with some statistics can go further with a chi-square test on the ten counts. With nine degrees of freedom, a value above about 16.9 would be surprising at the 5% level. A good generator should pass most of the time, and fail about one time in twenty.

Ask students to compare their counts. Every student gets different counts if they each pick their own seed, and the same counts if they all use the same seed.
