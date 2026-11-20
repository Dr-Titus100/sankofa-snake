import { describe, expect, it } from "vitest";
import {
  LANE_GAP,
  LEVELS,
  allOpenConnected,
  currentKeys,
  moveVehicles,
  newLayout,
  obstacleKeys,
  startZone,
  validateLevel,
  vehicleCells,
  type LevelDef,
} from "../src";

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);
const byId = (id: string) => LEVELS.find((l) => l.id === id)!;

/** Every vehicle's cells right now, with a check that no two vehicles share one. */
function vehicleCellsAll(level: LevelDef, fronts: number[]): string[] {
  return (level.vehicles ?? []).flatMap((v, i) => vehicleCells(v, level, fronts[i]).map((c) => `${c.x},${c.y}`));
}

describe("new layouts", () => {
  for (const level of LEVELS) {
    it(`gives fair layouts for the ${level.name}`, () => {
      for (const seed of SEEDS) {
        const made = newLayout(level, seed);
        expect(validateLevel(made), `seed ${seed}`).toEqual([]);
        expect(allOpenConnected(made), `seed ${seed}`).toBe(true);
        // The start zone stays clear.
        const blocked = obstacleKeys(made);
        const currents = currentKeys(made);
        for (const [x, y] of startZone(made)) {
          expect(blocked.has(`${x},${y}`) || currents.has(`${x},${y}`), `seed ${seed} at ${x},${y}`).toBe(false);
        }
      }
    });
  }

  it("keeps the same pieces, currents and vehicles, in new places", () => {
    for (const id of ["market", "city", "lab", "ocean", "village", "road"]) {
      const level = byId(id);
      const made = newLayout(level, 12345);
      expect(obstacleKeys(made).size).toBe(obstacleKeys(level).size);
      expect(made.vehicles?.length ?? 0).toBe(level.vehicles?.length ?? 0);
      expect((made.vehicles ?? []).map((v) => v.kind).sort()).toEqual((level.vehicles ?? []).map((v) => v.kind).sort());
      if (id !== "road") expect(made.map).not.toEqual(level.map);
    }
    // The ocean keeps all of its current cells, since it has no roads to cross them.
    expect(currentKeys(newLayout(byId("ocean"), 5)).size).toBe(currentKeys(byId("ocean")).size);
  });

  it("gives the same layout for the same seed and a different one for another seed", () => {
    for (const level of LEVELS.filter((l) => l.map || l.vehicles)) {
      expect(newLayout(level, 99)).toEqual(newLayout(level, 99));
      const maps = new Set(SEEDS.slice(0, 20).map((s) => JSON.stringify([newLayout(level, s).map, newLayout(level, s).vehicles])));
      expect(maps.size, level.id).toBeGreaterThan(15);
    }
  });

  it("almost never falls back to the level's own map", () => {
    for (const level of LEVELS.filter((l) => l.map || l.vehicles)) {
      const same = SEEDS.filter((s) => JSON.stringify(newLayout(level, s)) === JSON.stringify(level)).length;
      expect(same, level.id).toBe(0);
    }
  });

  it("leaves a level with nothing to move, or a fixed layout, as it is", () => {
    expect(newLayout(byId("farm"), 1)).toBe(byId("farm"));
    expect(newLayout(byId("park"), 1)).toBe(byId("park"));
    const fixed = { ...byId("city"), layout: "fixed" as const };
    expect(newLayout(fixed, 1)).toBe(fixed);
  });

  it("builds a new maze with no dead ends", () => {
    for (const seed of SEEDS) {
      const made = newLayout(byId("maze"), seed);
      const blocked = obstacleKeys(made);
      for (let y = 0; y < made.height; y++) {
        for (let x = 0; x < made.width; x++) {
          if (blocked.has(`${x},${y}`)) continue;
          const exits = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            return nx >= 0 && ny >= 0 && nx < made.width && ny < made.height && !blocked.has(`${nx},${ny}`);
          });
          expect(exits.length, `seed ${seed} at ${x},${y}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("puts crossing roads on the Road and in the Weaving village", () => {
    for (const id of ["road", "village"]) {
      for (const seed of SEEDS) {
        const axes = new Set(newLayout(byId(id), seed).vehicles!.map((v) => v.axis));
        expect(axes, `${id} seed ${seed}`).toEqual(new Set(["row", "column"]));
      }
    }
  });

  it("keeps parallel roads apart", () => {
    for (const seed of SEEDS) {
      const vs = newLayout(byId("road"), seed).vehicles!;
      for (const a of vs) {
        for (const b of vs) {
          if (a.axis === b.axis && a.lane !== b.lane) expect(Math.abs(a.lane - b.lane)).toBeGreaterThanOrEqual(LANE_GAP);
        }
      }
    }
  });

  it("never lets vehicles crash into each other or get stuck at a crossing", () => {
    for (const id of ["road", "village"]) {
      for (const seed of SEEDS) {
        const made = newLayout(byId(id), seed);
        const vs = made.vehicles!;
        let fronts = vs.map((v) => v.start);
        const moved = fronts.map(() => 0);
        const wait = fronts.map(() => 0);
        let longestWait = 0;
        let crashes = 0;
        for (let m = 1; m <= 1500; m++) {
          const next = moveVehicles(made, fronts, m, []);
          next.forEach((f, i) => {
            if (f !== fronts[i]) {
              moved[i]++;
              wait[i] = 0;
            } else if (m % vs[i].every === 0) {
              wait[i]++;
              longestWait = Math.max(longestWait, wait[i] * vs[i].every);
            }
          });
          fronts = next;
          const cells = vehicleCellsAll(made, fronts);
          if (new Set(cells).size !== cells.length) crashes++;
        }
        expect(crashes, `${id} seed ${seed}`).toBe(0);
        // Waiting for a line of crossing traffic takes a few turns, never more than 40 snake moves.
        expect(longestWait, `${id} seed ${seed}`).toBeLessThan(40);
        // Each vehicle moves on at least half of its turns.
        moved.forEach((n, i) => expect(n, `${id} seed ${seed} vehicle ${i}`).toBeGreaterThan((0.5 * 1500) / vs[i].every));
      }
    }
  });
});
