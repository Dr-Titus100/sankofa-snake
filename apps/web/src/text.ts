// Every piece of text the game shows or says, in one place, ready for French or Twi later.
// The level names and challenges live with the levels, in the levels/ folder.
// A translation copies this object, translates the strings and keeps the function shapes.
import type { GameState, PowerKind } from "../../../packages/core/src";

/** Text for the ways a player steers: keys on a computer, swipes and taps on a phone. */
export type Input = "keys" | "touch";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const TEXT = {
  name: "Sankofa Snake",
  logoLabel: "Sankofa bird, the game's logo",
  lead: "Steer a snake of woven kente blocks around the board and collect cowrie shells. Each level adds a new world and one new rule.",
  sankofaNote: 'Sankofa is an Akan word from Ghana. It means "go back and get it."',

  buttons: {
    play: "Play",
    daily: "Daily challenge",
    chooseLevel: "Choose a level",
    howToPlay: "How to play",
    back: "Back",
    pause: "Pause",
    resume: "Resume",
    sound: "Sound",
    vibration: "Vibration",
    playAgain: "Play again",
    practiceAgain: "Practice again",
    nextLevel: "Next level",
    playDaily: "Play today's challenge",
    reset: "Reset progress",
    confirmReset: "Delete my progress",
    cancel: "Cancel",
    toTitle: "Back to the title",
  },

  help: {
    heading: "How to play",
    steer: {
      keys: "Steer with the arrow keys or W, A, S and D. On a phone, swipe on the board or press the arrow buttons under it.",
      touch: "Steer with the arrow buttons under the board, or swipe on the board in the direction you want the snake to go.",
    },
    rules: [
      "Eat 20 cowrie shells to clear a level and open the next one. The snake grows longer with each shell.",
      "The run ends if the snake runs into its own tail, an obstacle or a vehicle. Vehicles stop for the snake, so cross the road in front of them or behind them. From the City on, the edge of the board is a wall too.",
      "In the Ocean and the Weaving village, currents push the snake one square the way their arrows point when it swims across them. Swimming along a current, the way its arrows point, makes the snake faster until it leaves the current.",
      "In the Lab, the Maze and the Weaving village, power-ups appear on the board for a short time. The gold hourglass is slow motion, the red arrows shrink the snake, and the green loop lets the snake pass through its own tail once.",
    ],
    pause: {
      keys: "Pause with Space, P or Escape. The game also pauses when you switch tabs.",
      touch: "Tap the board to pause. The game also pauses when you switch to another app or tab.",
    },
    more: [
      "Clearing a level earns one star. A high score and a fast finish earn up to two more.",
      "The daily challenge picks a world and its rules from the date, so everyone gets the same challenge on the same date. The date comes from your own device, so a new challenge starts at your midnight. Clear it on days in a row to build a streak.",
      "Free play is the classic game in any world you have opened, with wrap-around edges or walls. It goes on until the snake crashes.",
      "Practice opens every level at a slower speed. Running into something only stops the snake, so it suits a class demo.",
    ],
    soundKey: "Press M to turn the sound off or on.",
    settings: "Settings",
    settingsLabel: "Settings",
    goldMeansOn: "Gold means on.",
    vibrationNote: "Vibration works on most Android phones.",
    progress: "Your progress",
    progressNote: "Scores, stars, cleared levels, the daily streak and free play bests stay on this device.",
    confirm:
      "This deletes your scores, stars, cleared levels, daily streak and free play bests on this device. Your sound and vibration switches stay as they are. It can't be undone.",
    resetDone: "Progress deleted.",
  },

  levels: {
    heading: { levels: "Levels", free: "Free play", practice: "Practice" },
    tabsLabel: "Way to play",
    edgesLabel: "Edges",
    wrap: "Wrap-around edges",
    walls: "Walls",
    intro: {
      levels: "Clear a level to open the next one.",
      free: "Play the classic game in any world you have opened, until the snake crashes.",
      practice: "Every level, at a slower speed. Running into something only stops the snake.",
    },
    card: (n: number) => `Level ${n}`,
    locked: (previous: string) => `Clear the ${previous} to open this level`,
    practiceStatus: "Slower, and the run never ends",
    freeBest: (n: number) => `Best ${n} cowries`,
    best: (n: number) => `Best ${n}`,
    notPlayed: "Not played yet",
  },

  daily: {
    heading: "Daily challenge",
    lead: (date: string) => `${date}. Everyone gets the same challenge on the same date. A new one starts at midnight on your device.`,
    world: "Today's world",
    goal: (challenge: string, goal: number) => `${challenge} Eat ${goal} cowries to clear it.`,
    clearedToday: "Cleared today",
    notCleared: "Not cleared yet today",
    todaysBest: (n: number) => `Today's best ${n}`,
    streak: (now: number, longest: number) => ({
      label: "Streak:",
      now: plural(now, "day", "days"),
      rest: `Longest: ${plural(longest, "day", "days")}.`,
    }),
  },

  hud: {
    cowries: "Cowries",
    score: "Score",
    best: "Best",
    board: "Game board",
    eaten: (eaten: number, goal?: number) => (goal === undefined ? String(eaten) : `${eaten} of ${goal}`),
    slow: (moves: number) => `Slow motion for ${moves} more moves`,
    passes: (n: number) => (n === 1 ? "One pass through the tail" : `${n} passes through the tail`),
    hint: {
      keys: "Arrow keys or W, A, S and D to steer. Space to pause and M for sound.",
      touch: "Press the arrows or swipe on the board to steer. Tap the board to pause.",
    },
  },

  run: {
    level: (n: number, name: string) => `Level ${n}: ${name}`,
    daily: (name: string) => `Daily challenge: ${name}`,
    free: (name: string) => `Free play: ${name}`,
    practice: (name: string) => `Practice: ${name}`,
    start: { keys: "Press an arrow key to start.", touch: "Press an arrow or swipe to start." },
    bumpTitle: "Bump",
    bumpGo: "Choose a new direction to keep going.",
    paused: "Paused",
    over: "Game over",
    freeTally: (eaten: number, best: number) => `You collected ${plural(eaten, "cowrie", "cowries")}. Your best here is ${best}.`,
    tally: (eaten: number, goal: number, score: number) => `You collected ${eaten} of ${goal} cowries. Score ${score}.`,
    practiceDone: "Practice run complete",
    practiceTally: (goal: number, score: number) => `You collected all ${goal} cowries. Score ${score}.`,
    cleared: "Level cleared",
    dailyCleared: "Daily challenge cleared",
    stars: (n: number) => `${n} of 3 stars`,
    bonus: (score: number, bonus: number) => `Score ${score}, including a time bonus of ${bonus}.`,
    dailyStreak: (n: number) => `Your streak is ${plural(n, "day", "days")}. Come back tomorrow for a new challenge.`,
    bestStars: (n: number) => `Your best on this level is ${n} stars.`,
    allCleared: "You've cleared all nine levels.",
    errorTitle: "Something went wrong",
    error: "The game stopped because of an error. Your saved progress is safe.",
  },

  /** What the obstacles are in each world, for the message after a crash. */
  obstacle: {
    market: "a market stall",
    city: "a building",
    lab: "a lab bench",
    maze: "a wall of the maze",
    ocean: "a canoe",
    village: "a loom",
  } as Record<string, string>,
  hit: {
    wall: "the wall",
    obstacle: "an obstacle",
    vehicle: (name: string | undefined) => `a ${name ?? "car"}`,
    self: "its own tail",
  },
  crash: {
    pushed: (what: string) => `A current pushed the snake into ${what}.`,
    wall: "The snake hit the wall.",
    into: (what: string) => `The snake ran into ${what}.`,
    bumped: (what: string) => `The snake bumped into ${what}.`,
  },

  /** What the screen reader says. */
  say: {
    runStart: (title: string, challenge: string, start: string) => `${title}. ${challenge} ${start}`,
    paused: "Paused.",
    playing: "Playing.",
    setting: (name: "sound" | "vibration", on: boolean) => `${name === "sound" ? "Sound" : "Vibration"} ${on ? "on" : "off"}.`,
    ate: (eaten: number, score: number, goal?: number) =>
      `${goal === undefined ? `Cowrie ${eaten}` : `Cowrie ${eaten} of ${goal}`}. Score ${score}.`,
    bump: (bumped: string) => `${bumped} Choose a new direction.`,
    speedup: "The snake is faster now.",
    powerAppeared: (name: string) => `A ${name} power-up appeared.`,
    passed: "The snake passed through its tail.",
    crash: (text: string, score: number) => `${text} Score ${score}.`,
    practiceDone: (score: number) => `Practice run complete. Score ${score}.`,
    cleared: (daily: boolean, stars: number, score: number) =>
      `${daily ? "Daily challenge" : "Level"} cleared with ${stars} of 3 stars. Score ${score}.`,
  },

  power: {
    name: { slow: "slow motion", shrink: "shrink", pass: "pass" } as Record<PowerKind, string>,
    text: {
      slow: "Slow motion. The snake moves slower for a while.",
      shrink: "Shrink. The snake is shorter now.",
      pass: "Pass. The snake can go through its own tail once.",
    } as Record<PowerKind, string>,
  },

  /** The arrow buttons on phones and tablets. */
  pad: { label: "Steering", up: "Up", down: "Down", left: "Left", right: "Right" },

  cantSave: "This browser isn't letting the game save. Your progress lasts only until you close the page.",
};

/** What the snake ran into, as words for a sentence. */
export function hitName(s: GameState, cause: GameState["crash"]): string {
  const h = TEXT.hit;
  if (cause === "wall") return h.wall;
  if (cause === "obstacle") return TEXT.obstacle[s.level.world] ?? h.obstacle;
  if (cause === "vehicle") return h.vehicle(s.crashVehicle);
  return h.self;
}

/** One sentence saying what ended the run. */
export function crashText(s: GameState): string {
  const what = hitName(s, s.crash);
  if (s.crashPushed) return TEXT.crash.pushed(what);
  return s.crash === "wall" ? TEXT.crash.wall : TEXT.crash.into(what);
}

/** In practice, one sentence saying what stopped the snake. */
export const bumpText = (s: GameState) => TEXT.crash.bumped(hitName(s, s.bump));

/** Today's date in the player's own format, such as "Thursday 19 November" or "Thursday, November 19". */
export const longDate = (d: Date, locale?: string) =>
  d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

/** Makes text safe to put inside HTML, including inside an attribute. */
export function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
