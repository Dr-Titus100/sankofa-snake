// Checks the paint the board gives vehicles and canoes, so players can tell them apart.
import { describe, expect, it } from "vitest";
import { LEVELS, newLayout, obstacleKeys } from "../../../packages/core/src";
import { CANOE_PAINT, TAXI_PAINT, TROTRO_PAINT, canoeIndex, vehiclePaints } from "../src/render";
import { KENTE as K } from "../src/logo";

describe("vehicle and canoe paint", () => {
  it("gives each trotro and each taxi on a board its own color, with gold and black taxis", () => {
    const low = (c: string) => c.toLowerCase();
    const trotros = TROTRO_PAINT.map((p) => low(p.body));
    const taxis = TAXI_PAINT.map((p) => low(p.body));
    expect(new Set(trotros).size).toBe(trotros.length);
    expect(new Set(taxis).size).toBe(taxis.length);
    expect(taxis).toContain(low(K.gold));
    expect(taxis).toContain(low(K.black));
    for (const t of taxis) expect(trotros).not.toContain(t);
    // Every vehicle has red corner lights, so no body may be red.
    for (const body of [...trotros, ...taxis]) expect(body).not.toBe(low(K.red));
    // A black taxi needs a light outline to show on the dark road.
    for (const p of TAXI_PAINT) expect(low(p.outline)).not.toBe(low(p.body));
    for (const level of LEVELS) {
      const count = (kind: string) => (level.vehicles ?? []).filter((v) => v.kind === kind).length;
      expect(count("trotro"), level.name).toBeLessThanOrEqual(TROTRO_PAINT.length);
      expect(count("taxi"), level.name).toBeLessThanOrEqual(TAXI_PAINT.length);
    }
  });

  it("shows every trotro and taxi color over a few runs, never two the same on one board", () => {
    for (const world of ["road", "village"]) {
      const base = LEVELS.find((l) => l.world === world)!;
      const seen = { trotro: new Set<number>(), taxi: new Set<number>() };
      for (let seed = 1; seed <= 200; seed++) {
        const level = newLayout(base, seed);
        const paints = vehiclePaints(level);
        expect(vehiclePaints(level)).toEqual(paints);
        for (const kind of ["trotro", "taxi"] as const) {
          const mine = level.vehicles!.map((v, i) => (v.kind === kind ? paints[i] : -1)).filter((p) => p >= 0);
          expect(new Set(mine).size, `${world} ${seed} ${kind}`).toBe(mine.length);
          mine.forEach((p) => seen[kind].add(p));
        }
      }
      if (world === "road") {
        expect(seen.trotro.size).toBe(TROTRO_PAINT.length);
        expect(seen.taxi.size).toBe(TAXI_PAINT.length);
      }
    }
  });

  it("gives every canoe on the Ocean its own paint, the same on all its cells", () => {
    const ocean = LEVELS.find((l) => l.world === "ocean")!;
    expect(new Set(CANOE_PAINT.map((p) => p.hull)).size).toBe(CANOE_PAINT.length);
    for (let seed = 0; seed < 50; seed++) {
      const level = seed === 0 ? ocean : newLayout(ocean, seed);
      const cells = obstacleKeys(level);
      const byRow = new Map<string, number>();
      const paints = new Set<number>();
      for (const k of cells) {
        const [x, y] = k.split(",").map(Number);
        let start = x;
        while (cells.has(`${start - 1},${y}`)) start--;
        const index = canoeIndex(x, y, cells);
        const canoe = `${start},${y}`;
        if (byRow.has(canoe)) expect(byRow.get(canoe)).toBe(index);
        byRow.set(canoe, index);
        paints.add(index % CANOE_PAINT.length);
      }
      expect(byRow.size).toBeLessThanOrEqual(CANOE_PAINT.length);
      expect(paints.size, `seed ${seed}`).toBe(byRow.size);
    }
  });
});
