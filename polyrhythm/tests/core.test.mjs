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
  assert.equal(bleed.patterns[0].length, 32);
  assert.equal(bleed.patterns[0].instrument, "hi-hat");
  assert.equal(bleed.patterns[0].accentInstrument, "snare");
  assert.deepEqual(JSON.parse(JSON.stringify(bleed.patterns[0].cells.map((v, i) => v !== "rest" ? [i + 1, v] : null).filter(Boolean))), [[1, "hit"], [9, "hit"], [17, "accent"], [25, "hit"]]);
  assert.deepEqual(Array.from(bleed.patterns[1].cells.map((v, i) => v !== "rest" ? i + 1 : null).filter(Boolean)), [1, 2, 3, 5]);
  assert.equal(core.cycleLength(bleed), 96);

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

test("secondsPerStep treats each grid cell as a sixteenth note", () => {
  assert.equal(core.secondsPerStep(60), 0.25);
  assert.equal(core.secondsPerStep(120), 0.125);
});

test("eventsInRange emits hits, accents, metronome, and wraps", () => {
  const exercise = core.createBlankExercise();
  const first = pattern(4, ["hit", "rest", "accent", "rest"]);
  first.instrument = "kick";
  first.accentInstrument = "snare";
  exercise.patterns = [first, pattern(3, ["rest", "hit", "rest"])];
  exercise.metronome = true;
  const events = core.eventsInRange(exercise, 0, 5);
  assert.equal(events.find(event => event.source === "a" && event.step === 0).instrument, "kick");
  assert.equal(events.find(event => event.source === "a" && event.step === 2).instrument, "snare");
  assert.ok(events.some(event => event.source === "b" && event.step === 1));
  assert.ok(events.some(event => event.source === "metronome" && event.step === 0));
  assert.ok(events.some(event => event.source === "a" && event.step === 4));
});

test("legacy imported patterns default accentInstrument to their normal instrument", () => {
  const legacy = core.createBlankExercise();
  delete legacy.patterns[0].accentInstrument;
  const parsed = core.parseExerciseJson(JSON.stringify(legacy));
  assert.equal(parsed.patterns[0].accentInstrument, parsed.patterns[0].instrument);
});

test("muted and empty patterns produce no pattern events", () => {
  const exercise = core.createBlankExercise();
  exercise.metronome = false;
  exercise.patterns[0].muted = true;
  exercise.patterns[1].cells.fill("rest");
  assert.deepEqual(Array.from(core.eventsInRange(exercise, 0, 16)), []);
});

test("exercise JSON round-trips through schema validation", () => {
  const source = core.cloneExercise(core.PRESETS.bleed);
  source.name = "My Bleed Practice";
  const parsed = core.parseExerciseJson(core.serializeExercise(source));
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), JSON.parse(JSON.stringify(source)));
});

test("JSON import rejects unsupported versions and malformed cells", () => {
  const future = core.createBlankExercise();
  future.schemaVersion = 99;
  assert.throws(() => core.parseExerciseJson(JSON.stringify(future)), /schema version/);
  const malformed = core.createBlankExercise();
  malformed.patterns[0].cells[0] = "loud";
  assert.throws(() => core.parseExerciseJson(JSON.stringify(malformed)), /patterns\.0/);
});

test("failed parse does not mutate the caller's current exercise", () => {
  const current = core.createBlankExercise();
  const before = core.serializeExercise(current);
  assert.throws(() => core.parseExerciseJson('{"broken":true}'));
  assert.equal(core.serializeExercise(current), before);
});

test("production app is self-contained and exposes required controls", () => {
  assert.doesNotMatch(html, /<(script|link)[^>]+(?:src|href)=["']https?:/i);
  for (const label of [
    "BPM", "Count-in", "Metronome", "Steps per row", "Independent", "Phrase",
    "Kick", "Snare", "Hi-hat", "Woodblock", "Click",
    "Bleed", "The Art of Dying", "Import", "Export",
  ]) assert.ok(html.includes(label), `missing feature label: ${label}`);
});

test("production UI exposes accent selection and non-destructive text updates", () => {
  assert.match(html, /Accent instrument/);
  assert.match(html, /accentInstrument/);
  assert.match(html, /updateTextField/);
});
