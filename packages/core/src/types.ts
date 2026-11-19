// Shared types for the Sankofa Snake rules.
// The board is a grid of cells. x grows to the right and y grows downward, like a canvas.

export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  x: number;
  y: number;
}

/** What happens when the snake moves past the edge of the board. */
export type Edges = "wrap" | "walls";

/** The places a level can take place in. Each one has its own scenery in the web game. */
export type World = "farm" | "park" | "market" | "city" | "road" | "lab" | "maze";

/**
 * A vehicle that drives along one row or column of the board and comes back around at the far
 * edge. It moves one cell every few snake moves, so it speeds up when the snake does. It stops
 * and waits while the snake or another vehicle is in the way, so only the snake's head can hit it.
 */
export interface VehicleDef {
  kind: "trotro" | "taxi";
  /** "row" drives left or right along a row. "column" drives up or down a column. */
  axis: "row" | "column";
  /** The row or column number the vehicle drives along. */
  lane: number;
  /** 1 drives right or down. -1 drives left or up. */
  dir: 1 | -1;
  /** How many cells long the vehicle is. */
  length: number;
  /** The vehicle moves one cell every this many snake moves. */
  every: number;
  /** Where the front of the vehicle starts along its lane. */
  start: number;
}

/**
 * The power-ups. "slow" slows the snake down for a while, "shrink" takes a few cells off the tail,
 * and "pass" lets the snake pass through its own tail once.
 */
export type PowerKind = "slow" | "shrink" | "pass";

/** When power-ups appear on a level and how long each one stays. */
export interface PowerUpRule {
  /** The kinds that can appear. Each time one appears, it is picked at random from this list. */
  kinds: PowerKind[];
  /** A power-up appears after every this many cowries. */
  every: number;
  /** A power-up the snake doesn't reach within this many moves goes away. */
  lasts: number;
}

/** A power-up lying on the board. */
export interface PowerUp {
  kind: PowerKind;
  at: Cell;
  /** It goes away when the move count reaches this number. */
  until: number;
}

/** One level, as written in a file in the levels/ folder. */
export interface LevelDef {
  id: string;
  number: number;
  name: string;
  /** Which scenery the web game draws for this level. */
  world: World;
  /** One sentence the level card shows, saying what is new in this level. */
  challenge: string;
  width: number;
  height: number;
  edges: Edges;
  speed: {
    /** Moves per second at the start. */
    start: number;
    /** Moves per second added at each speed-up. 0 means the speed never changes. */
    step: number;
    /** A speed-up happens after this many cowries. */
    every: number;
    /** The speed never goes above this many moves per second. */
    max: number;
  };
  /** Cowries to eat to clear the level. */
  goal: number;
  /** Clearing the level faster than this many seconds earns a time bonus. */
  parSeconds: number;
  /** Scores needed for two and three stars. Clearing the level earns one star. */
  stars: [number, number];
  start: { x: number; y: number; dir: Direction; length: number };
  /**
   * The board as rows of text, one character per cell: "." is open ground and "#" is an obstacle.
   * Leave it out for a board with no obstacles.
   */
  map?: string[];
  /** Vehicles driving across the board. Running the snake's head into one ends the run. */
  vehicles?: VehicleDef[];
  /** Power-ups that appear while the snake eats. Leave it out for a level with none. */
  powerUps?: PowerUpRule;
}

export type Status = "ready" | "running" | "paused" | "over" | "cleared";

export type Crash = "self" | "wall" | "obstacle" | "vehicle";

export interface GameState {
  level: LevelDef;
  /** The snake's cells, head first. */
  snake: Cell[];
  /** The direction of the last move. */
  dir: Direction;
  /** Turns the player pressed that haven't been used yet, oldest first. */
  queue: Direction[];
  food: Cell | null;
  /** Obstacle cells, as "x,y" keys for quick lookup. */
  obstacles: Set<string>;
  eaten: number;
  score: number;
  /** Moves per second right now. */
  speed: number;
  /** How many speed-ups have happened. Each cowrie is worth more after each one. */
  speedLevel: number;
  /** Extra cells left to grow, for power-ups. Each cowrie already adds one cell on the move that eats it. */
  grow: number;
  /** Game time in milliseconds, counted by moves, so pauses don't count. */
  elapsedMs: number;
  /** How many moves the snake has made. Vehicles count their moves from it. */
  moves: number;
  /** Where the front of each vehicle is along its lane, in the order of level.vehicles. */
  vehicles: number[];
  /** The power-up on the board, or null when there is none. */
  powerUp: PowerUp | null;
  /** The snake moves slowly until the move count reaches this number. */
  slowUntil: number;
  /** How many more times the snake can pass through its own tail. */
  passes: number;
  status: Status;
  /** What ended the run, when status is "over". */
  crash?: Crash;
  /** The kind of vehicle the snake ran into, when crash is "vehicle". */
  crashVehicle?: VehicleDef["kind"];
  /** The cell the snake tried to move into when it crashed. */
  crashAt?: Cell;
  /** The random number generator's state, so a seed always gives the same cowrie spots. */
  rng: number;
}

export type GameEvent =
  | { type: "ate"; at: Cell; points: number }
  | { type: "speedup"; speed: number }
  | { type: "crash"; cause: Crash }
  | { type: "power"; kind: PowerKind }
  | { type: "powerAppeared"; kind: PowerKind; at: Cell }
  | { type: "powerGone" }
  | { type: "passed" }
  | { type: "cleared"; score: number; stars: number; timeBonus: number };
