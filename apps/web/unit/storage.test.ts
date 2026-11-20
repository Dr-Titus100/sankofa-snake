// Checks how saved progress is read: damaged and tampered saves, old saves, and a full round trip.
import { describe, expect, it } from "vitest";
import { LIMITS, SAVE_VERSION, cleanProgress, isDate, recordDaily, recordFree, recordRun, resetProgress } from "../src/storage";
import { esc } from "../src/text";

const HTML = `<img src=x onerror="alert(1)">`;

describe("cleanProgress", () => {
  it("starts fresh from anything that isn't an object", () => {
    for (const input of [null, undefined, 3, "text", [], true]) expect(cleanProgress(input)).toEqual({ levels: {} });
  });

  it("keeps a full, valid save exactly as it was", () => {
    const full = {
      levels: { farm: { best: 900, stars: 3, cleared: true }, park: { best: 0, stars: 0, cleared: false } },
      daily: { date: "2026-11-19", best: 640, cleared: true, streak: 4, lastCleared: "2026-11-18", bestStreak: 6 },
      free: { "farm-wrap": 31, "village-walls": 2 },
      settings: { sound: false, vibration: true },
    };
    expect(cleanProgress({ version: SAVE_VERSION, ...full })).toEqual(full);
    // A save and a load give back the same progress.
    expect(cleanProgress(JSON.parse(JSON.stringify(cleanProgress(full))))).toEqual(full);
  });

  it("reads a save from 0.6, which has no version number", () => {
    const old = { levels: { farm: { best: 300, stars: 2, cleared: true } }, settings: { sound: false, vibration: false } };
    expect(cleanProgress(old)).toEqual(old);
  });

  it("drops HTML, wrong types and values out of range", () => {
    const p = cleanProgress({
      levels: {
        farm: { best: HTML, stars: 9, cleared: "yes" },
        park: { best: -5, stars: 2.5, cleared: true },
        city: { best: LIMITS.score + 1, stars: 3, cleared: 1 },
        [HTML]: { best: 1, stars: 1, cleared: true },
        market: "cleared",
      },
      free: { "farm-wrap": HTML, "park-walls": 4.2, "nowhere-wrap": 3, "farm-sideways": 3, "lab-walls": 7 },
      settings: { sound: HTML, vibration: false },
    });
    expect(p.levels).toEqual({
      farm: { best: 0, stars: 0, cleared: false },
      park: { best: 0, stars: 0, cleared: true },
      city: { best: 0, stars: 3, cleared: false },
    });
    expect(p.free).toEqual({ "lab-walls": 7 });
    // Only false turns a switch off. Anything else leaves it on.
    expect(p.settings).toEqual({ sound: true, vibration: false });
  });

  it("drops a daily record without a real date, and a streak without its last clear", () => {
    expect(cleanProgress({ levels: {}, daily: { date: HTML, best: 5, cleared: true, streak: 3, bestStreak: 3 } }).daily).toBeUndefined();
    expect(cleanProgress({ levels: {}, daily: { date: "2026-02-30", best: 5, cleared: true, streak: 3, bestStreak: 3 } }).daily).toBeUndefined();
    const d = cleanProgress({ levels: {}, daily: { date: "2026-11-19", best: 5, cleared: true, streak: 3, bestStreak: 1, lastCleared: HTML } }).daily;
    expect(d).toEqual({ date: "2026-11-19", best: 5, cleared: true, streak: 0, bestStreak: 1 });
    const e = cleanProgress({ levels: {}, daily: { date: "2026-11-19", best: 5, cleared: true, streak: 8, bestStreak: 2, lastCleared: "2026-11-19" } }).daily;
    // The longest streak is never shorter than the current one.
    expect(e?.bestStreak).toBe(8);
  });

  it("never throws, whatever the save holds", () => {
    const weird = [{ levels: null }, { levels: [] }, { daily: [] }, { free: "x" }, { settings: 1 }, { levels: { farm: null } }];
    for (const w of weird) expect(() => cleanProgress(w)).not.toThrow();
  });
});

describe("the save helpers", () => {
  it("recognizes real dates only", () => {
    expect(isDate("2026-11-19")).toBe(true);
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2026-13-01")).toBe(false);
    expect(isDate("19/11/2026")).toBe(false);
  });

  it("reset keeps only the switches", () => {
    let p = recordRun({ levels: {}, settings: { sound: false, vibration: true } }, "farm", 300, 2, true);
    p = recordDaily(p, "2026-11-19", 400, true);
    p = recordFree(p, "farm-wrap", 12);
    expect(resetProgress(p)).toEqual({ levels: {}, settings: { sound: false, vibration: true } });
    expect(resetProgress({ levels: { farm: { best: 1, stars: 1, cleared: true } } })).toEqual({ levels: {} });
  });
});

describe("esc", () => {
  it("makes text safe inside HTML and inside attributes", () => {
    expect(esc(HTML)).toBe("&#60;img src=x onerror=&#34;alert(1)&#34;&#62;");
    expect(esc(`a & 'b'`)).toBe("a &#38; &#39;b&#39;");
    expect(esc(42)).toBe("42");
  });
});
