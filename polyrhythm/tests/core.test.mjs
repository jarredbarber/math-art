import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const match = html.match(/<script id="polyrhythm-core">([\s\S]*?)<\/script>/);
assert.ok(match, "index.html must contain script#polyrhythm-core");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(match[1], context);
const core = context.window.PolyrhythmCore;

const pattern = (length, cells = []) => ({
  name: "Pattern",
  color: "#22d3ee",
  length,
  cells: Array.from({ length }, (_, index) => cells[index] ?? "rest"),
  grouping: [],
  instrument: "click",
  muted: false,
});

test("gcd and lcm handle normal and maximum pattern pairs", () => {
  assert.equal(core.gcd(45, 4), 1);
  assert.equal(core.lcm(16, 6), 48);
  assert.equal(core.lcm(63, 64), 4032);
});

test("cycleLength selects independent LCM or phrase length", () => {
  const exercise = { loopMode: "independent", phraseLength: 32, patterns: [pattern(16), pattern(6)] };
  assert.equal(core.cycleLength(exercise), 48);
  exercise.loopMode = "phrase";
  assert.equal(core.cycleLength(exercise), 32);
});

test("cellAt repeats a base pattern at arbitrary offsets", () => {
  const p = pattern(3, ["hit", "rest", "accent"]);
  assert.equal(core.cellAt(p, 0), "hit");
  assert.equal(core.cellAt(p, 4), "rest");
  assert.equal(core.cellAt(p, 8), "accent");
});

test("segmentRows keeps configured wrapping and allows a partial final row", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.segmentRows(45, 16))),
    [{ start: 0, length: 16 }, { start: 16, length: 16 }, { start: 32, length: 13 }],
  );
});
