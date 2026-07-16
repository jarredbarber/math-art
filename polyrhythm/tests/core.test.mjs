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

test("cycleCell follows rest, hit, accent, rest", () => {
  assert.equal(core.cycleCell("rest"), "hit");
  assert.equal(core.cycleCell("hit"), "accent");
  assert.equal(core.cycleCell("accent"), "rest");
});

test("parseGrouping accepts positive CSV and rejects holes", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(core.parseGrouping("5, 5,3"))), [5, 5, 3]);
  assert.deepEqual(JSON.parse(JSON.stringify(core.parseGrouping("   "))), []);
  assert.throws(() => core.parseGrouping("5,,3"), /positive whole numbers/);
  assert.throws(() => core.parseGrouping("40,25"), /64/);
});

test("applying grouping changes length without changing existing hits", () => {
  const p = pattern(4, ["hit", "rest", "accent", "rest"]);
  const next = core.applyGrouping(p, "3,3");
  assert.equal(next.length, 6);
  assert.deepEqual(Array.from(next.cells.slice(0, 4)), p.cells);
  assert.deepEqual(Array.from(next.cells.slice(4)), ["rest", "rest"]);
  assert.deepEqual(Array.from(next.grouping), [3, 3]);
});

test("shortening reports discarded active cells before applying", () => {
  const p = pattern(4, ["rest", "rest", "hit", "accent"]);
  const result = core.resizePattern(p, 2);
  assert.equal(result.requiresConfirmation, true);
  assert.deepEqual(Array.from(result.discarded), ["hit", "accent"]);
  assert.equal(result.pattern.length, 2);
});

test("Bleed and Art of Dying presets match the specification", () => {
  const bleed = core.PRESETS.bleed;
  assert.equal(bleed.patterns[0].length, 16);
  assert.deepEqual(JSON.parse(JSON.stringify(bleed.patterns[0].cells.map((v, i) => v !== "rest" ? [i + 1, v] : null).filter(Boolean))), [[1, "hit"], [9, "accent"]]);
  assert.deepEqual(Array.from(bleed.patterns[1].cells.map((v, i) => v !== "rest" ? i + 1 : null).filter(Boolean)), [1, 2, 3, 5]);
  assert.equal(core.cycleLength(bleed), 48);

  const dying = core.PRESETS.artOfDying;
  assert.deepEqual(Array.from(dying.patterns[1].grouping), [5, 5, 5, 3, 3, 3, 5, 5, 5, 3, 3]);
  assert.ok(dying.patterns[1].cells.every(value => value === "rest"));
  assert.equal(core.cycleLength(dying), 180);
});

test("validateExercise returns field-specific errors", () => {
  const invalid = core.createBlankExercise();
  invalid.bpm = 301;
  invalid.stepsPerRow = 3;
  const result = core.validateExercise(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.bpm, /20.*300/);
  assert.match(result.errors.stepsPerRow, /4.*64/);
});

test("cloneExercise prevents preset mutation", () => {
  const copy = core.cloneExercise(core.PRESETS.bleed);
  copy.patterns[0].cells[0] = "accent";
  assert.equal(core.PRESETS.bleed.patterns[0].cells[0], "hit");
});

test("production markup contains accessible editor and transport contracts", () => {
  for (const token of [
    'id="transport"', 'id="pattern-editors"', 'id="loop-controls"',
    'aria-live="polite"', 'class="pattern-cell"', 'data-state',
  ]) assert.ok(html.includes(token), `missing ${token}`);
});

test("groupBoundaryAt repeats labels and boundaries across cycles", () => {
  const p = { ...pattern(8), grouping: [3, 5] };
  assert.deepEqual(JSON.parse(JSON.stringify(core.groupBoundaryAt(p, 0))), { startsGroup: true, size: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(core.groupBoundaryAt(p, 3))), { startsGroup: true, size: 5 });
  assert.deepEqual(JSON.parse(JSON.stringify(core.groupBoundaryAt(p, 8))), { startsGroup: true, size: 3 });
  assert.equal(core.groupBoundaryAt(p, 2), null);
});

test("timelineRows projects paired repeating lanes", () => {
  const exercise = core.createBlankExercise();
  exercise.patterns = [pattern(4, ["hit"]), pattern(3, ["accent"])];
  exercise.stepsPerRow = 5;
  const rows = core.timelineRows(exercise);
  assert.equal(rows.length, 3);
  assert.deepEqual(Array.from(rows[0].a), ["hit", "rest", "rest", "rest", "hit"]);
  assert.deepEqual(Array.from(rows[0].b), ["accent", "rest", "rest", "accent", "rest"]);
  assert.equal(rows[2].length, 2);
});
