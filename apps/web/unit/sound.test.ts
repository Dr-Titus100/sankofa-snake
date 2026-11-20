import { describe, expect, it } from "vitest";
import { LEVELS } from "../../../packages/core/src";
import { VOICES } from "../src/sound";

describe("world sounds", () => {
  it("gives every world its own instrument", () => {
    const worlds = [...new Set(LEVELS.map((l) => l.world))];
    expect(worlds.length).toBe(9);
    for (const w of worlds) expect(VOICES[w], w).toBeDefined();
    const sounds = new Set(worlds.map((w) => JSON.stringify({ ...VOICES[w], name: "" })));
    expect(sounds.size).toBe(worlds.length);
  });

  it("keeps every voice in a range a phone speaker can play", () => {
    for (const [world, v] of Object.entries(VOICES)) {
      expect(v.partials.length, world).toBeGreaterThan(0);
      for (const [ratio, level, share] of v.partials) {
        expect(ratio * v.octave * 392, world).toBeGreaterThan(150);
        expect(ratio * v.octave * 1319, world).toBeLessThan(12000);
        expect(level, world).toBeGreaterThan(0);
        expect(level, world).toBeLessThanOrEqual(1);
        expect(share, world).toBeGreaterThan(0);
      }
      expect(v.attack, world).toBeGreaterThan(0);
    }
  });
});
