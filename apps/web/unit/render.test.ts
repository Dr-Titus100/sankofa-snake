// Checks the paint the board gives vehicles and canoes, so players can tell them apart.
import { describe, expect, it } from "vitest";
import { LEVELS, newLayout, obstacleKeys } from "../../../packages/core/src";
import { CANOE_PAINT, TROTRO_PAINT, canoeIndex } from "../src/render";
import { KENTE as K } from "../src/logo";

describe("vehicle and canoe paint", () => {
  it("never paints a trotro gold like a taxi, and gives each trotro its own color", () => {
    for (const p of TROTRO_PAINT) expect(p.body.toLowerCase()).not.toBe(K.gold.toLowerCase());
    expect(new Set(TROTRO_PAINT.map((p) => p.body)).size).toBe(TROTRO_PAINT.length);
    for (const level of LEVELS) {
      const trotros = (level.vehicles ?? []).filter((v) => v.kind === "trotro").length;
      expect(trotros, level.name).toBeLessThanOrEqual(TROTRO_PAINT.length);
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
