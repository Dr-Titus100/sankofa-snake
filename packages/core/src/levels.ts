// The levels, read from the data files in the levels/ folder at the top of the repo.
// Each file describes one world: its size, edges, speed, goal and obstacles.
// Adding a level means adding a file there and listing it below.
import farm from "../../../levels/01-farm.json";
import park from "../../../levels/02-park.json";
import market from "../../../levels/03-market.json";
import type { LevelDef } from "./types";

export const LEVELS: LevelDef[] = [farm, park, market] as LevelDef[];

/** The obstacle cells of a level, as "x,y" keys. */
export function obstacleKeys(level: LevelDef): Set<string> {
  const keys = new Set<string>();
  level.map?.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") keys.add(`${x},${y}`);
    });
  });
  return keys;
}

/** Checks a level file for mistakes. Returns a list of problems, empty when the level is fine. */
export function validateLevel(level: LevelDef): string[] {
  const problems: string[] = [];
  const { width, height, start, speed } = level;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8) {
    problems.push("the board must be whole numbers of cells, at least 8 by 8");
  }
  if (level.map) {
    if (level.map.length !== height) problems.push(`the map has ${level.map.length} rows, expected ${height}`);
    level.map.forEach((row, y) => {
      if (row.length !== width) problems.push(`map row ${y} has ${row.length} cells, expected ${width}`);
      if (/[^.#]/.test(row)) problems.push(`map row ${y} uses a character other than "." and "#"`);
    });
  }
  if (speed.start <= 0 || speed.max < speed.start || speed.step < 0 || speed.every < 1) {
    problems.push("the speed settings don't make sense");
  }
  if (level.goal < 1) problems.push("the goal must be at least one cowrie");
  if (level.stars[0] > level.stars[1]) problems.push("the three-star score must be at least the two-star score");

  // The snake's starting cells must be on open ground and inside the board.
  const obstacles = obstacleKeys(level);
  const back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[start.dir];
  for (let i = 0; i < start.length; i++) {
    const x = start.x + back[0] * i;
    const y = start.y + back[1] * i;
    if (x < 0 || y < 0 || x >= width || y >= height) problems.push(`start cell ${x},${y} is off the board`);
    else if (obstacles.has(`${x},${y}`)) problems.push(`start cell ${x},${y} is on an obstacle`);
  }
  return problems;
}
